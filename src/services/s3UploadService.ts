import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand, ListPartsCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadChunk, FileUpload, S3UploadConfig, UploadError } from '@/types/upload';
import { calculateChunkChecksum, sleep, calculateBackoffDelay } from '@/utils/fileUtils';

export class S3UploadService {
  private s3Client: S3Client;
  private config: S3UploadConfig;
  private activeUploads = new Map<string, AbortController>();

  constructor(config: S3UploadConfig) {
    this.config = config;
    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  /**
   * Initialize multipart upload
   */
  async initializeUpload(fileUpload: FileUpload): Promise<{ uploadId: string; uploadUrl: string }> {
    try {
      const command = new CreateMultipartUploadCommand({
        Bucket: this.config.bucketName,
        Key: fileUpload.fileName,
        ContentType: fileUpload.file.type || 'application/octet-stream',
        Metadata: {
          originalSize: fileUpload.fileSize.toString(),
          checksum: fileUpload.checksum || '',
          uploadId: fileUpload.id,
        },
      });

      const response = await this.s3Client.send(command);
      
      if (!response.UploadId) {
        throw new Error('Failed to initialize multipart upload');
      }

      return {
        uploadId: response.UploadId,
        uploadUrl: `s3://${this.config.bucketName}/${fileUpload.fileName}`,
      };
    } catch (error) {
      throw this.handleS3Error(error, fileUpload.id);
    }
  }

  /**
   * Upload a single chunk
   */
  async uploadChunk(
    fileUpload: FileUpload,
    chunk: UploadChunk,
    onProgress?: (progress: number) => void
  ): Promise<{ etag: string; chunkNumber: number }> {
    const abortController = new AbortController();
    this.activeUploads.set(`${fileUpload.id}-${chunk.chunkNumber}`, abortController);

    try {
      // Validate chunk data exists and is a Blob
      if (!chunk.chunkData || typeof chunk.chunkData.arrayBuffer !== 'function') {
        throw new Error(`Invalid chunk data for chunk ${chunk.chunkNumber}. Please recreate the upload.`);
      }

      // Convert Blob to Uint8Array to avoid stream reading issues
      const chunkArrayBuffer = await chunk.chunkData.arrayBuffer();
      const chunkUint8Array = new Uint8Array(chunkArrayBuffer);
      
      // Calculate chunk checksum for integrity
      const chunkChecksum = await calculateChunkChecksum(chunk.chunkData);

      const command = new UploadPartCommand({
        Bucket: this.config.bucketName,
        Key: fileUpload.fileName,
        PartNumber: chunk.chunkNumber,
        UploadId: fileUpload.uploadId,
        Body: chunkUint8Array, // Use Uint8Array instead of Blob
        ContentLength: chunk.chunkSize,
      });

      // Add progress tracking if supported
      if (onProgress) {
        // Note: AWS SDK v3 doesn't have built-in progress tracking
        // We'll simulate progress for now, but this could be enhanced with a custom request handler
        const progressInterval = setInterval(() => {
          if (!abortController.signal.aborted) {
            onProgress(50); // Simulate 50% progress during upload
          }
        }, 100);

        const response = await this.s3Client.send(command, {
          abortSignal: abortController.signal,
        });

        clearInterval(progressInterval);
        onProgress(100);

        if (!response.ETag) {
          throw new Error('No ETag received from S3');
        }

        return {
          etag: response.ETag,
          chunkNumber: chunk.chunkNumber,
        };
      } else {
        const response = await this.s3Client.send(command, {
          abortSignal: abortController.signal,
        });

        if (!response.ETag) {
          throw new Error('No ETag received from S3');
        }

        return {
          etag: response.ETag,
          chunkNumber: chunk.chunkNumber,
        };
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        throw new Error('Upload was cancelled');
      }
      throw this.handleS3Error(error, fileUpload.id, chunk.chunkNumber);
    } finally {
      this.activeUploads.delete(`${fileUpload.id}-${chunk.chunkNumber}`);
    }
  }

  /**
   * Upload multiple chunks in parallel
   */
  async uploadChunksParallel(
    fileUpload: FileUpload,
    chunks: UploadChunk[],
    onChunkComplete?: (chunkNumber: number, etag: string) => void,
    onProgress?: (uploadId: string, progress: number) => void,
    isActiveChecker?: () => boolean
  ): Promise<void> {
    const maxConcurrent = this.config.maxConcurrentUploads;
    const unuploadedChunks = chunks.filter(chunk => !chunk.uploaded);
    
    if (unuploadedChunks.length === 0) {
      return;
    }

    const uploadPromises: Promise<void>[] = [];
    let completedChunks = 0;
    
    for (let i = 0; i < unuploadedChunks.length; i += maxConcurrent) {
      // Check if upload is still active before processing batch
      if (isActiveChecker && !isActiveChecker()) {
        throw new Error('Upload paused or cancelled');
      }
      
      const chunkBatch = unuploadedChunks.slice(i, i + maxConcurrent);
      
      const batchPromises = chunkBatch.map(async (chunk) => {
        let retryCount = 0;
        
        while (retryCount < this.config.retryAttempts) {
          // Check if upload is still active before each retry
          if (isActiveChecker && !isActiveChecker()) {
            throw new Error('Upload paused or cancelled');
          }
          
          try {
            const result = await this.uploadChunk(fileUpload, chunk, (progress) => {
              if (onProgress) {
                const totalProgress = ((completedChunks + (progress / 100)) / unuploadedChunks.length) * 100;
                onProgress(fileUpload.id, totalProgress);
              }
            });

            if (onChunkComplete) {
              onChunkComplete(result.chunkNumber, result.etag);
            }

            completedChunks++;
            
            if (onProgress) {
              const totalProgress = (completedChunks / unuploadedChunks.length) * 100;
              onProgress(fileUpload.id, totalProgress);
            }

            break; // Success, exit retry loop
          } catch (error) {
            // If upload was paused/cancelled, don't retry
            if (isActiveChecker && !isActiveChecker()) {
              throw new Error('Upload paused or cancelled');
            }
            
            retryCount++;
            
            if (retryCount >= this.config.retryAttempts) {
              throw error;
            }

            // Exponential backoff
            const delay = calculateBackoffDelay(retryCount);
            await sleep(delay);
          }
        }
      });

      uploadPromises.push(...batchPromises);
    }

    await Promise.all(uploadPromises);
  }

  /**
   * Complete multipart upload
   */
  async completeUpload(fileUpload: FileUpload): Promise<string> {
    try {
      const uploadedChunks = fileUpload.chunks
        .filter(chunk => chunk.uploaded && chunk.etag)
        .sort((a, b) => a.chunkNumber - b.chunkNumber);

      const parts = uploadedChunks.map(chunk => ({
        ETag: chunk.etag!,
        PartNumber: chunk.chunkNumber,
      }));

      const command = new CompleteMultipartUploadCommand({
        Bucket: this.config.bucketName,
        Key: fileUpload.fileName,
        UploadId: fileUpload.uploadId,
        MultipartUpload: { Parts: parts },
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Location) {
        throw new Error('Upload completion failed');
      }

      return response.Location;
    } catch (error) {
      throw this.handleS3Error(error, fileUpload.id);
    }
  }

  /**
   * Abort multipart upload
   */
  async abortUpload(fileUpload: FileUpload): Promise<void> {
    try {
      if (!fileUpload.uploadId) {
        return;
      }

      const command = new AbortMultipartUploadCommand({
        Bucket: this.config.bucketName,
        Key: fileUpload.fileName,
        UploadId: fileUpload.uploadId,
      });

      await this.s3Client.send(command);
    } catch (error) {
      // Don't throw on abort errors, just log them
      console.warn('Failed to abort upload:', error);
    }
  }

  /**
   * Cancel a specific chunk upload
   */
  cancelChunkUpload(uploadId: string, chunkNumber: number): void {
    const key = `${uploadId}-${chunkNumber}`;
    const abortController = this.activeUploads.get(key);
    
    if (abortController) {
      abortController.abort();
      this.activeUploads.delete(key);
    }
  }

  /**
   * Cancel all uploads for a file
   */
  cancelFileUpload(uploadId: string): void {
    const keysToCancel = Array.from(this.activeUploads.keys())
      .filter(key => key.startsWith(uploadId));
    keysToCancel.forEach(key => {
      const abortController = this.activeUploads.get(key);
      if (abortController && !abortController.signal.aborted) {
        try {
          abortController.abort();
        } catch (error) {
          console.warn(`Failed to abort chunk upload ${key}:`, error);
        }
        this.activeUploads.delete(key);
      }
    });
  }

  /**
   * List uploaded parts to resume upload
   */
  async listUploadedParts(fileUpload: FileUpload): Promise<number[]> {
    try {
      if (!fileUpload.uploadId) {
        return [];
      }

      const command = new ListPartsCommand({
        Bucket: this.config.bucketName,
        Key: fileUpload.fileName,
        UploadId: fileUpload.uploadId,
      });

      const response = await this.s3Client.send(command);
      
      return response.Parts?.map(part => part.PartNumber || 0).filter(Boolean) || [];
    } catch (error) {
      console.warn('Failed to list uploaded parts:', error);
      return [];
    }
  }

  /**
   * Generate a presigned download URL for the uploaded file
   */
  async generateDownloadUrl(fileUpload: FileUpload, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.config.bucketName,
        Key: fileUpload.fileName,
        ResponseContentDisposition: `attachment; filename="${fileUpload.fileName}"`,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn });
      return url;
    } catch (error) {
      console.error('Failed to generate download URL:', error);
      // Fallback to direct S3 URL if presigned URL fails
      return `https://${this.config.bucketName}.s3.${this.config.region}.amazonaws.com/${encodeURIComponent(fileUpload.fileName)}`;
    }
  }

  /**
   * Handle S3 errors and convert to UploadError
   */
  private handleS3Error(error: any, uploadId?: string, chunkNumber?: number): UploadError {
    const code = error.code || error.name || 'UNKNOWN_ERROR';
    let message = error.message || 'An unknown error occurred';
    let retryable = false;

    // Determine if error is retryable
    switch (code) {
      case 'NetworkingError':
      case 'TimeoutError':
      case 'ThrottlingException':
      case 'ServiceUnavailable':
      case 'InternalError':
        retryable = true;
        break;
      case 'NoSuchUpload':
      case 'InvalidAccessKeyId':
      case 'SignatureDoesNotMatch':
      case 'AccessDenied':
        retryable = false;
        break;
      default:
        // Assume network-related errors are retryable
        retryable = message.toLowerCase().includes('network') || 
                   message.toLowerCase().includes('timeout') ||
                   message.toLowerCase().includes('connection');
    }

    return {
      code,
      message,
      uploadId,
      chunkNumber,
      retryable,
    };
  }
}

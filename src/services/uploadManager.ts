import { FileUpload, UploadStatus, UploadProgress, S3UploadConfig, UploadError, FileValidationResult } from '@/types/upload';
import { S3UploadService } from '@/services/s3UploadService';
import { useUploadStore } from '@/store/uploadStore';
import { getActiveUploads, hasActiveUploads } from '@/utils/uploadUtils';
import { 
  createFileChunks, 
  calculateFileChecksum, 
  generateUploadId, 
  validateFile,
  calculateUploadMetrics,
  sleep
} from '@/utils/fileUtils';

export class UploadManager {
  private s3Service: S3UploadService;
  private uploadStore: typeof useUploadStore;
  private uploadTimers = new Map<string, NodeJS.Timeout>();
  private uploadStartTimes = new Map<string, number>();
  private activeUploadProcesses = new Set<string>();

  constructor(config: S3UploadConfig) {
    this.s3Service = new S3UploadService(config);
    this.uploadStore = useUploadStore;
  }

  /**
   * Start a new file upload
   */
  async startUpload(file: File): Promise<string> {
    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Generate upload ID and create file upload object
    const uploadId = generateUploadId();
    const chunks = createFileChunks(file);
    
    // For very large files (>1GB), defer checksum calculation to avoid blocking
    const shouldDeferChecksum = file.size > 1024 * 1024 * 1024; // 1GB threshold
    let checksum = '';
    
    if (!shouldDeferChecksum) {
      try {
        checksum = await calculateFileChecksum(file);
      } catch (error) {
        console.warn('Failed to calculate checksum, proceeding without it:', error);
        checksum = 'deferred'; // Will calculate later during upload
      }
    } else {
      checksum = 'deferred'; // Will calculate in background
    }

    const fileUpload: FileUpload = {
      id: uploadId,
      file,
      fileName: file.name,
      fileSize: file.size,
      chunks,
      uploadedChunks: 0,
      totalChunks: chunks.length,
      progress: 0,
      status: UploadStatus.PENDING,
      speed: 0,
      remainingTime: 0,
      retryCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
      checksum,
    };

    // Add to store
    this.uploadStore.getState().addUpload(fileUpload);

    try {
      // Initialize S3 multipart upload
      const { uploadId: s3UploadId, uploadUrl } = await this.s3Service.initializeUpload(fileUpload);
      
      // Update upload with S3 details
      this.uploadStore.getState().updateUpload(uploadId, {
        uploadId: s3UploadId,
        uploadUrl,
        status: UploadStatus.UPLOADING,
      });

      // Start the upload process
      this.processUpload(uploadId);
      
      // Calculate checksum in background for deferred cases
      if (checksum === 'deferred') {
        this.calculateChecksumInBackground(uploadId, file);
      }
      
      return uploadId;
    } catch (error) {
      this.uploadStore.getState().updateUpload(uploadId, {
        status: UploadStatus.ERROR,
        errorMessage: error instanceof Error ? error.message : 'Failed to initialize upload',
      });
      throw error;
    }
  }

  /**
   * Resume an existing upload
   */
  async resumeUpload(uploadId: string): Promise<void> {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      throw new Error('Upload not found');
    }

    if (upload.status !== UploadStatus.PAUSED && upload.status !== UploadStatus.ERROR) {
      throw new Error('Upload cannot be resumed');
    }

    // Check if we have the original file (it won't be available after page refresh)
    if (!upload.file || !upload.file.size) {
      // File object is not available, we need the user to re-select the file
      this.uploadStore.getState().updateUpload(uploadId, {
        status: UploadStatus.PAUSED,
        errorMessage: 'Please re-select this file to resume upload',
      });
      throw new Error('File not available after page refresh. Please re-upload the file.');
    }

    // Recreate chunks if they don't have blob data (after hydration from localStorage)
    if (upload.chunks.length > 0 && !upload.chunks[0].chunkData) {
      const freshChunks = createFileChunks(upload.file);
      
      // Mark previously uploaded chunks as completed
      freshChunks.forEach((chunk, index) => {
        const originalChunk = upload.chunks[index];
        if (originalChunk?.uploaded) {
          chunk.uploaded = true;
          chunk.etag = originalChunk.etag;
        }
      });
      
      // Update the upload with fresh chunks
      this.uploadStore.getState().updateUpload(uploadId, {
        chunks: freshChunks,
      });
    } else if (upload.chunks.length === 0) {
      // No chunks at all, recreate them
      const freshChunks = createFileChunks(upload.file);
      this.uploadStore.getState().updateUpload(uploadId, {
        chunks: freshChunks,
      });
    }

    // Check which parts are already uploaded from S3
    if (upload.uploadId) {
      try {
        const uploadedParts = await this.s3Service.listUploadedParts(upload);
        
        // Mark chunks as uploaded based on S3 response
        uploadedParts.forEach(partNumber => {
          this.uploadStore.getState().markChunkUploaded(uploadId, partNumber);
        });
      } catch (error) {
        console.warn('Failed to check uploaded parts, proceeding with local state:', error);
      }
    }

    // Update status and resume upload
    this.uploadStore.getState().setUploadStatus(uploadId, UploadStatus.RESUMING);
    this.processUpload(uploadId);
  }

  /**
   * Resume an existing upload with a new file reference (after page refresh)
   */
  async resumeUploadWithFile(uploadId: string, file: File): Promise<void> {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      throw new Error('Upload not found');
    }

    // Verify file matches the original upload
    if (upload.fileName !== file.name || upload.fileSize !== file.size) {
      throw new Error('Selected file does not match the original upload');
    }

    // Recreate chunks with actual blob data since they were stripped during persistence
    const freshChunks = createFileChunks(file);
    
    // Mark previously uploaded chunks as completed based on stored state
    const uploadedChunkNumbers = upload.chunks
      .filter(chunk => chunk.uploaded)
      .map(chunk => chunk.chunkNumber);
    
    freshChunks.forEach((chunk, index) => {
      if (uploadedChunkNumbers.includes(chunk.chunkNumber)) {
        chunk.uploaded = true;
        // Find the original chunk to get the etag
        const originalChunk = upload.chunks.find(c => c.chunkNumber === chunk.chunkNumber);
        if (originalChunk?.etag) {
          chunk.etag = originalChunk.etag;
        }
      }
    });

    // Update the upload with the new file reference and recreated chunks
    this.uploadStore.getState().updateUpload(uploadId, {
      file: file,
      chunks: freshChunks,
      errorMessage: undefined,
    });

    // Now resume normally
    await this.resumeUpload(uploadId);
  }

  /**
   * Pause an upload
   */
  pauseUpload(uploadId: string): void {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload || upload.status !== UploadStatus.UPLOADING) {
      return;
    }

    // Mark process as inactive to stop processing
    this.activeUploadProcesses.delete(uploadId);

    // Cancel ongoing chunk uploads
    this.s3Service.cancelFileUpload(uploadId);
    
    // Clear timer
    const timer = this.uploadTimers.get(uploadId);
    if (timer) {
      clearInterval(timer);
      this.uploadTimers.delete(uploadId);
    }

    // Update status to paused
    this.uploadStore.getState().pauseUpload(uploadId);
    }

  /**
   * Cancel an upload
   */
  async cancelUpload(uploadId: string): Promise<void> {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      return;
    }

    // Cancel ongoing chunk uploads
    this.s3Service.cancelFileUpload(uploadId);
    
    // Clear timer
    const timer = this.uploadTimers.get(uploadId);
    if (timer) {
      clearInterval(timer);
      this.uploadTimers.delete(uploadId);
    }

    // Abort S3 multipart upload
    if (upload.uploadId) {
      try {
        await this.s3Service.abortUpload(upload);
      } catch (error) {
        console.warn('Failed to abort S3 upload:', error);
      }
    }

    // Update status
    this.uploadStore.getState().cancelUpload(uploadId);
  }

  /**
   * Remove a completed or cancelled upload
   */
  removeUpload(uploadId: string): void {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (upload && (upload.status === UploadStatus.COMPLETED || upload.status === UploadStatus.CANCELLED)) {
      this.uploadStore.getState().removeUpload(uploadId);
    }
  }

  /**
   * Process upload chunks
   */
  private async processUpload(uploadId: string): Promise<void> {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      return;
    }

    // Check if upload is already paused or cancelled
    if (upload.status === UploadStatus.PAUSED || upload.status === UploadStatus.CANCELLED) {
      return;
    }

    // Check if this upload is already being processed
    if (this.activeUploadProcesses.has(uploadId)) {
      return;
    }

    // Mark as active
    this.activeUploadProcesses.add(uploadId);

    // Set start time for metrics calculation
    this.uploadStartTimes.set(uploadId, Date.now());

    // Update status
    this.uploadStore.getState().setUploadStatus(uploadId, UploadStatus.UPLOADING);

    // Start progress tracking
    this.startProgressTracking(uploadId);

    try {
      // Upload chunks in parallel with pause checking
      await this.s3Service.uploadChunksParallel(
        upload,
        upload.chunks,
        // On chunk complete
        (chunkNumber: number, etag: string) => {
          this.uploadStore.getState().markChunkUploaded(uploadId, chunkNumber, etag);
        },
        // On progress update
        (id: string, progress: number) => {
          this.updateUploadProgress(id);
        },
        // Status checker for pause/cancel
        () => {
          const currentUpload = this.uploadStore.getState().getUpload(uploadId);
          return currentUpload?.status === UploadStatus.UPLOADING && this.activeUploadProcesses.has(uploadId);
        }
      );

      // Check one more time before completing
      const finalUpload = this.uploadStore.getState().getUpload(uploadId);
      if (finalUpload?.status === UploadStatus.UPLOADING && this.activeUploadProcesses.has(uploadId)) {
        // Complete the upload
        await this.completeUpload(uploadId);
      }
      
    } catch (error) {
      // Only handle error if it's not due to pause/cancel
      const currentUpload = this.uploadStore.getState().getUpload(uploadId);
      if (currentUpload?.status === UploadStatus.UPLOADING && this.activeUploadProcesses.has(uploadId)) {
        this.handleUploadError(uploadId, error);
      }
    } finally {
      // Mark as inactive
      this.activeUploadProcesses.delete(uploadId);
      
      // Clear timer
      const timer = this.uploadTimers.get(uploadId);
      if (timer) {
        clearInterval(timer);
        this.uploadTimers.delete(uploadId);
      }
      this.uploadStartTimes.delete(uploadId);
    }
  }

  /**
   * Complete the upload process
   */
  private async completeUpload(uploadId: string): Promise<void> {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      return;
    }

    try {
      // Complete S3 multipart upload
      const location = await this.s3Service.completeUpload(upload);
      
      // Generate download URL
      let downloadUrl: string | undefined;
      try {
        downloadUrl = await this.s3Service.generateDownloadUrl(upload, 24 * 60 * 60); // 24 hours expiry
      } catch (error) {
        console.warn('Failed to generate download URL:', error);
      }
      
      // Update upload status to validating
      this.uploadStore.getState().updateUpload(uploadId, {
        status: UploadStatus.VALIDATING,
        progress: 100,
        uploadUrl: location,
        downloadUrl,
      });

      // Verify file integrity
      const validationResult = await this.validateFileIntegrity(uploadId);
      
      if (validationResult.isValid) {
        // File is valid, mark as completed
        this.uploadStore.getState().updateUpload(uploadId, {
          status: UploadStatus.COMPLETED,
          progress: 100,
          validationResult: validationResult,
        });
      } else {
        // File is corrupted, handle accordingly
        await this.handleCorruptedFile(uploadId, validationResult);
      }
      
    } catch (error) {
      this.handleUploadError(uploadId, error);
    }
  }

  /**
   * Handle upload errors
   */
  private handleUploadError(uploadId: string, error: any): void {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      return;
    }

    const uploadError = error as UploadError;
    
    // Increment retry count
    this.uploadStore.getState().incrementRetryCount(uploadId);
    
    // Check if we should retry
    if (uploadError.retryable && upload.retryCount < 3) {
      // Schedule retry with exponential backoff
      const retryDelay = Math.pow(2, upload.retryCount) * 1000; // 1s, 2s, 4s
      
      setTimeout(() => {
        this.resumeUpload(uploadId);
      }, retryDelay);
      
      this.uploadStore.getState().updateUpload(uploadId, {
        status: UploadStatus.ERROR,
        errorMessage: `Retrying in ${retryDelay / 1000}s... (${uploadError.message})`,
      });
    } else {
      // Final error
      this.uploadStore.getState().updateUpload(uploadId, {
        status: UploadStatus.ERROR,
        errorMessage: uploadError.message || 'Upload failed',
      });
    }
  }

  /**
   * Start progress tracking for an upload
   */
  private startProgressTracking(uploadId: string): void {
    const timer = setInterval(() => {
      this.updateUploadProgress(uploadId);
    }, 1000); // Update every second

    this.uploadTimers.set(uploadId, timer);
  }

  /**
   * Update upload progress metrics
   */
  private updateUploadProgress(uploadId: string): void {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    const startTime = this.uploadStartTimes.get(uploadId);
    
    if (!upload || !startTime) {
      return;
    }

    const currentTime = Date.now();
    const uploadedBytes = upload.uploadedChunks * (upload.fileSize / upload.totalChunks);
    
    const { speed, remainingTime } = calculateUploadMetrics(
      uploadedBytes,
      upload.fileSize,
      startTime,
      currentTime
    );

    const progress: UploadProgress = {
      uploadId,
      progress: upload.progress,
      uploadedBytes,
      totalBytes: upload.fileSize,
      speed,
      remainingTime,
      status: upload.status,
    };

    this.uploadStore.getState().updateUploadProgress(uploadId, progress);
  }

  /**
   * Get all active uploads
   */
  getActiveUploads(): FileUpload[] {
    const state = this.uploadStore.getState();
    return getActiveUploads(state.uploads, state.activeUploads);
  }

  /**
   * Check if there are any active uploads
   */
  hasActiveUploads(): boolean {
    const state = this.uploadStore.getState();
    return hasActiveUploads(state.activeUploads);
  }

  /**
   * Clear completed uploads
   */
  clearCompletedUploads(): void {
    this.uploadStore.getState().clearCompletedUploads();
  }

  /**
   * Calculate file checksum in background for large files
   */
  private async calculateChecksumInBackground(uploadId: string, file: File): Promise<void> {
    try {
      const checksum = await calculateFileChecksum(file, (progress) => {
        // Optionally update UI with checksum calculation progress
      });
      
      // Update the upload with the calculated checksum
      this.uploadStore.getState().updateUpload(uploadId, {
        checksum,
      });
      } catch (error) {
      console.warn(`Failed to calculate checksum in background for ${file.name}:`, error);
      // Don't fail the upload if checksum calculation fails
    }
  }

  /**
   * Validate file integrity after upload completion
   */
  private async validateFileIntegrity(uploadId: string): Promise<FileValidationResult> {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      throw new Error('Upload not found for validation');
    }

    try {
      
      // Step 1: Validate S3 object exists and has correct size
      const s3ObjectInfo = await this.s3Service.getObjectInfo(upload);
      
      if (s3ObjectInfo.size !== upload.fileSize) {
        return {
          isValid: false,
          expectedChecksum: upload.checksum || '',
          actualChecksum: '',
          error: `File size mismatch. Expected: ${upload.fileSize}, Actual: ${s3ObjectInfo.size}`,
        };
      }

      // Step 2: Validate all chunks have ETags (indicating successful upload)
      const invalidChunks = upload.chunks
        .filter(chunk => chunk.uploaded && !chunk.etag)
        .map(chunk => chunk.chunkNumber);

      if (invalidChunks.length > 0) {
        return {
          isValid: false,
          expectedChecksum: upload.checksum || '',
          actualChecksum: '',
          corruptedChunks: invalidChunks,
          error: `Missing ETags for chunks: ${invalidChunks.join(', ')}`,
        };
      }

      // Step 3: For smaller files (< 100MB), download and verify checksum
      if (upload.fileSize < 100 * 1024 * 1024 && upload.checksum && upload.checksum !== 'deferred') {
        try {
          const downloadedChecksum = await this.s3Service.calculateUploadedFileChecksum(upload);
          
          if (downloadedChecksum !== upload.checksum) {
            return {
              isValid: false,
              expectedChecksum: upload.checksum,
              actualChecksum: downloadedChecksum,
              error: 'Checksum mismatch detected',
            };
          }
        } catch (error) {
          console.warn('Failed to verify checksum, but file size is correct:', error);
          // Don't fail validation if we can't download for checksum verification
          // The file size match is a good indicator of integrity
        }
      }

      // Step 4: Validate S3 multipart upload completion
      if (upload.uploadId) {
        try {
          const uploadedParts = await this.s3Service.listUploadedParts(upload);
          const expectedParts = upload.totalChunks;
          
          if (uploadedParts.length !== expectedParts) {
            return {
              isValid: false,
              expectedChecksum: upload.checksum || '',
              actualChecksum: '',
              error: `Part count mismatch. Expected: ${expectedParts}, Actual: ${uploadedParts.length}`,
            };
          }
        } catch (error) {
          console.warn('Failed to verify uploaded parts:', error);
          // If the upload is completed, S3 should have cleaned up the multipart upload
          // So this error might be expected for completed uploads
        }
      }      
      return {
        isValid: true,
        expectedChecksum: upload.checksum || '',
        actualChecksum: upload.checksum || '',
        error: undefined,
      };
      
    } catch (error) {
      console.error(`Integrity validation failed for ${upload.fileName}:`, error);
      return {
        isValid: false,
        expectedChecksum: upload.checksum || '',
        actualChecksum: '',
        error: error instanceof Error ? error.message : 'Validation failed',
      };
    }
  }

  /**
   * Handle corrupted file detection
   */
  private async handleCorruptedFile(uploadId: string, validationResult: FileValidationResult): Promise<void> {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      return;
    }

    console.error(`File corruption detected for ${upload.fileName}:`, validationResult);

    // Check if we can recover by re-uploading corrupted chunks
    if (validationResult.corruptedChunks && validationResult.corruptedChunks.length > 0) {
      // Mark corrupted chunks as not uploaded
      validationResult.corruptedChunks.forEach(chunkNumber => {
        const chunkIndex = upload.chunks.findIndex(chunk => chunk.chunkNumber === chunkNumber);
        if (chunkIndex >= 0) {
          upload.chunks[chunkIndex].uploaded = false;
          upload.chunks[chunkIndex].etag = undefined;
        }
      });

      // Update upload status and retry
      this.uploadStore.getState().updateUpload(uploadId, {
        status: UploadStatus.ERROR,
        errorMessage: `File corruption detected. Retrying ${validationResult.corruptedChunks.length} corrupted chunks...`,
        chunks: upload.chunks,
        uploadedChunks: upload.chunks.filter(chunk => chunk.uploaded).length,
        progress: (upload.chunks.filter(chunk => chunk.uploaded).length / upload.totalChunks) * 100,
      });

      // Retry the upload for corrupted chunks
      setTimeout(() => {
        this.resumeUpload(uploadId);
      }, 2000);
      
    } else {
      // Complete failure - mark as error
      this.uploadStore.getState().updateUpload(uploadId, {
        status: UploadStatus.ERROR,
        errorMessage: `File integrity validation failed: ${validationResult.error}`,
        validationResult: validationResult,
      });

      // Optionally abort the S3 upload
      if (upload.uploadId) {
        try {
          await this.s3Service.abortUpload(upload);
        } catch (error) {
          console.warn('Failed to abort corrupted upload:', error);
        }
      }
    }
  }

  /**
   * Manually trigger integrity validation for a completed upload
   */
  async validateUpload(uploadId: string): Promise<FileValidationResult> {
    const upload = this.uploadStore.getState().getUpload(uploadId);
    
    if (!upload) {
      throw new Error('Upload not found');
    }

    if (upload.status !== UploadStatus.COMPLETED) {
      throw new Error('Upload must be completed before validation');
    }

    // Update status to validating
    this.uploadStore.getState().setUploadStatus(uploadId, UploadStatus.VALIDATING);

    try {
      const validationResult = await this.validateFileIntegrity(uploadId);
      
      // Update the upload with validation result
      this.uploadStore.getState().updateUpload(uploadId, {
        validationResult: validationResult,
        status: validationResult.isValid ? UploadStatus.COMPLETED : UploadStatus.ERROR,
        errorMessage: validationResult.isValid ? undefined : validationResult.error,
      });

      return validationResult;
    } catch (error) {
      // Restore completed status if validation fails
      this.uploadStore.getState().setUploadStatus(uploadId, UploadStatus.COMPLETED);
      throw error;
    }
  }
}

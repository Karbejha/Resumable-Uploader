import { FileUpload, UploadStatus, UploadProgress, S3UploadConfig, UploadError } from '@/types/upload';
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
    
    console.log(`Upload ${uploadId} paused successfully`);
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
      
      // Update upload status
      this.uploadStore.getState().updateUpload(uploadId, {
        status: UploadStatus.COMPLETED,
        progress: 100,
        uploadUrl: location,
        downloadUrl,
      });

      // TODO: Verify file integrity
      // This could be done by downloading and comparing checksums
      
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
      console.log(`Starting background checksum calculation for ${file.name}`);
      const checksum = await calculateFileChecksum(file, (progress) => {
        // Optionally update UI with checksum calculation progress
        console.log(`Checksum calculation progress: ${progress.toFixed(1)}%`);
      });
      
      // Update the upload with the calculated checksum
      this.uploadStore.getState().updateUpload(uploadId, {
        checksum,
      });
      
      console.log(`Background checksum calculation completed for ${file.name}`);
    } catch (error) {
      console.warn(`Failed to calculate checksum in background for ${file.name}:`, error);
      // Don't fail the upload if checksum calculation fails
    }
  }
}

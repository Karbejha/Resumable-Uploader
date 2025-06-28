export interface UploadChunk {
  chunkNumber: number;
  chunkSize: number;
  chunkData: Blob;
  startByte: number;
  endByte: number;
  etag?: string;
  uploaded: boolean;
}

export interface FileUpload {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  uploadUrl?: string;
  uploadId?: string;
  chunks: UploadChunk[];
  uploadedChunks: number;
  totalChunks: number;
  progress: number;
  status: UploadStatus;
  speed: number;
  remainingTime: number;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  checksum?: string;
}

export enum UploadStatus {
  PENDING = 'pending',
  UPLOADING = 'uploading',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  ERROR = 'error',
  CANCELLED = 'cancelled',
  RESUMING = 'resuming'
}

export interface UploadProgress {
  uploadId: string;
  progress: number;
  uploadedBytes: number;
  totalBytes: number;
  speed: number;
  remainingTime: number;
  status: UploadStatus;
}

export interface S3UploadConfig {
  bucketName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  chunkSize: number;
  maxConcurrentUploads: number;
  retryAttempts: number;
}

export interface UploadError {
  code: string;
  message: string;
  uploadId?: string;
  chunkNumber?: number;
  retryable: boolean;
}

export interface StoredUploadState {
  uploads: { [key: string]: FileUpload };
  activeUploads: string[];
}

export interface FileValidationResult {
  isValid: boolean;
  expectedChecksum: string;
  actualChecksum: string;
  corruptedChunks?: number[];
}

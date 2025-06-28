import { UploadChunk } from '@/types/upload';
import CryptoJS from 'crypto-js';

export const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB default chunk size
export const MAX_CHUNK_SIZE = 100 * 1024 * 1024; // 100MB max chunk size
export const MIN_CHUNK_SIZE = 5 * 1024 * 1024; // 5MB min chunk size

/**
 * Calculate optimal chunk size based on file size
 */
export function calculateChunkSize(fileSize: number): number {
  if (fileSize <= 50 * 1024 * 1024) { // <= 50MB
    return MIN_CHUNK_SIZE; // 5MB chunks
  } else if (fileSize <= 500 * 1024 * 1024) { // <= 500MB
    return 10 * 1024 * 1024; // 10MB chunks
  } else if (fileSize <= 5 * 1024 * 1024 * 1024) { // <= 5GB
    return 25 * 1024 * 1024; // 25MB chunks
  } else if (fileSize <= 50 * 1024 * 1024 * 1024) { // <= 50GB
    return 50 * 1024 * 1024; // 50MB chunks
  } else {
    return MAX_CHUNK_SIZE; // 100MB chunks for very large files
  }
}

/**
 * Split file into chunks
 */
export function createFileChunks(file: File, chunkSize?: number): UploadChunk[] {
  const optimalChunkSize = chunkSize || calculateChunkSize(file.size);
  const chunks: UploadChunk[] = [];
  const totalChunks = Math.ceil(file.size / optimalChunkSize);

  for (let i = 0; i < totalChunks; i++) {
    const startByte = i * optimalChunkSize;
    const endByte = Math.min(startByte + optimalChunkSize, file.size);
    const chunkData = file.slice(startByte, endByte);

    chunks.push({
      chunkNumber: i + 1,
      chunkSize: endByte - startByte,
      chunkData,
      startByte,
      endByte,
      uploaded: false,
    });
  }

  return chunks;
}

/**
 * Calculate file checksum for integrity verification using chunked reading
 */
export async function calculateFileChecksum(
  file: File, 
  onProgress?: (progress: number) => void
): Promise<string> {
  const CHUNK_SIZE = 1024 * 1024; // 1MB chunks for hash calculation
  const hasher = CryptoJS.algo.SHA256.create();
  
  let offset = 0;
  
  while (offset < file.size) {
    const chunk = file.slice(offset, offset + CHUNK_SIZE);
    const arrayBuffer = await readChunkAsArrayBuffer(chunk);
    
    // Check if the ArrayBuffer is too large for CryptoJS
    if (arrayBuffer.byteLength > 0) {
      try {
        const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
        hasher.update(wordArray);
      } catch (error) {
        console.warn('Falling back to smaller chunks for hash calculation');
        // If still too large, process in even smaller chunks
        await processLargeChunk(arrayBuffer, hasher);
      }
    }
    
    offset += CHUNK_SIZE;
    
    // Report progress if callback provided
    if (onProgress) {
      const progress = Math.min((offset / file.size) * 100, 100);
      onProgress(progress);
    }
  }
  
  return hasher.finalize().toString();
}

/**
 * Process very large chunks by breaking them down further
 */
async function processLargeChunk(arrayBuffer: ArrayBuffer, hasher: any): Promise<void> {
  const SMALL_CHUNK_SIZE = 64 * 1024; // 64KB
  let offset = 0;
  
  while (offset < arrayBuffer.byteLength) {
    const endOffset = Math.min(offset + SMALL_CHUNK_SIZE, arrayBuffer.byteLength);
    const smallChunk = arrayBuffer.slice(offset, endOffset);
    const wordArray = CryptoJS.lib.WordArray.create(smallChunk);
    hasher.update(wordArray);
    offset = endOffset;
  }
}

/**
 * Helper function to read a chunk as ArrayBuffer
 */
function readChunkAsArrayBuffer(chunk: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as ArrayBuffer;
      if (!result) {
        reject(new Error('Failed to read chunk'));
        return;
      }
      resolve(result);
    };
    reader.onerror = () => reject(new Error('FileReader error'));
    reader.readAsArrayBuffer(chunk);
  });
}

/**
 * Calculate chunk checksum
 */
export async function calculateChunkChecksum(chunk: Blob): Promise<string> {
  const arrayBuffer = await readChunkAsArrayBuffer(chunk);
  const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
  const hash = CryptoJS.SHA256(wordArray).toString();
  return hash;
}

/**
 * Format file size to human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds === Infinity || isNaN(seconds)) return 'Calculating...';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Format upload speed
 */
export function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`;
}

/**
 * Validate file type and size
 */
export function validateFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = 200 * 1024 * 1024 * 1024; // 200GB
  const minSize = 5 * 1024 * 1024; // 5MB

  if (file.size < minSize) {
    return {
      isValid: false,
      error: `File size must be at least ${formatFileSize(minSize)}`,
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `File size cannot exceed ${formatFileSize(maxSize)}`,
    };
  }

  return { isValid: true };
}

/**
 * Generate unique upload ID
 */
export function generateUploadId(): string {
  return `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate upload speed and remaining time
 */
export function calculateUploadMetrics(
  uploadedBytes: number,
  totalBytes: number,
  startTime: number,
  currentTime: number
): { speed: number; remainingTime: number } {
  const elapsedTime = (currentTime - startTime) / 1000; // in seconds
  const speed = uploadedBytes / elapsedTime; // bytes per second
  const remainingBytes = totalBytes - uploadedBytes;
  const remainingTime = remainingBytes / speed;

  return {
    speed: isNaN(speed) ? 0 : speed,
    remainingTime: isNaN(remainingTime) ? Infinity : remainingTime,
  };
}

/**
 * Sleep function for retry delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff calculation
 */
export function calculateBackoffDelay(attempt: number, baseDelay = 1000): number {
  return Math.min(baseDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
}

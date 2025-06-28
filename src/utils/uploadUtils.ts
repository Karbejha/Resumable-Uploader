import { FileUpload, UploadStatus } from '@/types/upload';

// Utility functions to compute derived state from store data
export const getActiveUploads = (uploads: { [key: string]: FileUpload }, activeUploadIds: string[]): FileUpload[] => {
  return activeUploadIds.map(id => uploads[id]).filter(Boolean);
};

export const getTotalProgress = (uploads: { [key: string]: FileUpload }, activeUploadIds: string[]): number => {
  const activeUploads = getActiveUploads(uploads, activeUploadIds);
  if (activeUploads.length === 0) return 0;
  
  const totalProgress = activeUploads.reduce((sum, upload) => sum + upload.progress, 0);
  return totalProgress / activeUploads.length;
};

export const hasActiveUploads = (activeUploadIds: string[]): boolean => {
  return activeUploadIds.length > 0;
};

export const getUploadingCount = (uploads: { [key: string]: FileUpload }, activeUploadIds: string[]): number => {
  const activeUploads = getActiveUploads(uploads, activeUploadIds);
  return activeUploads.filter(u => u.status === UploadStatus.UPLOADING).length;
};

export const getPausedCount = (uploads: { [key: string]: FileUpload }, activeUploadIds: string[]): number => {
  const activeUploads = getActiveUploads(uploads, activeUploadIds);
  return activeUploads.filter(u => u.status === UploadStatus.PAUSED).length;
};

export const getTotalSpeed = (uploads: { [key: string]: FileUpload }, activeUploadIds: string[]): number => {
  const activeUploads = getActiveUploads(uploads, activeUploadIds);
  return activeUploads
    .filter(u => u.status === UploadStatus.UPLOADING)
    .reduce((sum, u) => sum + u.speed, 0);
};

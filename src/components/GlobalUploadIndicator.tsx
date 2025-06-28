'use client';

import React from 'react';
import { useUploadStore } from '@/store/uploadStore';
import { UploadStatus } from '@/types/upload';
import ProgressBar from './ProgressBar';
import { formatFileSize, formatSpeed } from '@/utils/fileUtils';
import { 
  getActiveUploads, 
  getTotalProgress, 
  hasActiveUploads, 
  getUploadingCount, 
  getPausedCount, 
  getTotalSpeed 
} from '@/utils/uploadUtils';

export default function GlobalUploadIndicator() {
  // Use basic selectors to avoid infinite loops
  const uploads = useUploadStore((state) => state.uploads);
  const activeUploadIds = useUploadStore((state) => state.activeUploads);
  
  // Compute derived values using utility functions
  const activeUploads = getActiveUploads(uploads, activeUploadIds);
  const isActive = hasActiveUploads(activeUploadIds);
  const totalProgress = getTotalProgress(uploads, activeUploadIds);

  if (!isActive) {
    return null;
  }

  const uploadingCount = getUploadingCount(uploads, activeUploadIds);
  const pausedCount = getPausedCount(uploads, activeUploadIds);
  const totalSpeed = getTotalSpeed(uploads, activeUploadIds);

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span className="text-sm font-medium">
                Uploading {activeUploads.length} file{activeUploads.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            <div className="text-sm opacity-90">
              {uploadingCount > 0 && (
                <span>{uploadingCount} active</span>
              )}
              {pausedCount > 0 && (
                <>
                  {uploadingCount > 0 && ' • '}
                  <span>{pausedCount} paused</span>
                </>
              )}
              {totalSpeed > 0 && (
                <>
                  {(uploadingCount > 0 || pausedCount > 0) && ' • '}
                  <span>{formatSpeed(totalSpeed)}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-sm font-medium">
              {totalProgress.toFixed(1)}%
            </div>
            
            <ProgressBar 
              progress={totalProgress} 
              color="blue"
              size="md"
              className="w-32"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { FileUpload, UploadStatus } from '@/types/upload';
import { UploadManager } from '@/services/uploadManager';
import { formatFileSize, formatSpeed, formatTimeRemaining } from '@/utils/fileUtils';
import ProgressBar from './ProgressBar';

interface UploadItemProps {
  upload: FileUpload;
  uploadManager: UploadManager;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export default function UploadItem({ upload, uploadManager, onComplete, onError }: UploadItemProps) {
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const handlePause = () => {
    setIsPausing(true);
    uploadManager.pauseUpload(upload.id);
    // Reset the pausing state after a delay to show immediate feedback
    setTimeout(() => setIsPausing(false), 1000);
  };

  const handleResume = () => {
    setIsResuming(true);
    uploadManager.resumeUpload(upload.id).catch((error) => {
      onError?.(error.message);
    }).finally(() => {
      setIsResuming(false);
    });
  };

  const handleCancel = () => {
    uploadManager.cancelUpload(upload.id).then(() => {
      // Upload cancelled successfully
    }).catch((error) => {
      onError?.(error.message);
    });
  };

  const getStatusColor = () => {
    switch (upload.status) {
      case UploadStatus.UPLOADING:
        return 'text-blue-600';
      case UploadStatus.PAUSED:
        return 'text-yellow-600';
      case UploadStatus.COMPLETED:
        return 'text-green-600';
      case UploadStatus.ERROR:
        return 'text-red-600';
      case UploadStatus.CANCELLED:
        return 'text-gray-600';
      default:
        return 'text-gray-600';
    }
  };

  const getProgressBarColorName = (): 'blue' | 'green' | 'yellow' | 'red' | 'gray' => {
    if (isPausing || isResuming) return 'yellow';
    
    switch (upload.status) {
      case UploadStatus.UPLOADING:
        return 'blue';
      case UploadStatus.PAUSED:
        return 'yellow';
      case UploadStatus.COMPLETED:
        return 'green';
      case UploadStatus.ERROR:
        return 'red';
      default:
        return 'gray';
    }
  };

  const getStatusText = () => {
    if (isPausing) return 'Pausing...';
    if (isResuming) return 'Resuming...';
    
    switch (upload.status) {
      case UploadStatus.UPLOADING:
        return 'Uploading';
      case UploadStatus.PAUSED:
        return 'Paused';
      case UploadStatus.COMPLETED:
        return 'Completed';
      case UploadStatus.ERROR:
        return 'Error';
      case UploadStatus.CANCELLED:
        return 'Cancelled';
      case UploadStatus.RESUMING:
        return 'Resuming...';
      default:
        return upload.status;
    }
  };

  const canPause = upload.status === UploadStatus.UPLOADING && !isPausing;
  const canResume = (upload.status === UploadStatus.PAUSED || upload.status === UploadStatus.ERROR) && !isResuming;
  const canCancel = upload.status !== UploadStatus.COMPLETED && upload.status !== UploadStatus.CANCELLED;

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      {/* File Info */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {upload.fileName}
          </h4>
          <p className="text-xs text-gray-500">
            {formatFileSize(upload.fileSize)} • {upload.totalChunks} chunks
          </p>
        </div>
        
        <div className="flex items-center space-x-2 ml-4">
          {canPause && (
            <button
              onClick={handlePause}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Pause upload"
              aria-label="Pause upload"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          
          {canResume && (
            <button
              onClick={handleResume}
              className="p-2 text-blue-500 hover:text-blue-600 transition-colors"
              title="Resume upload"
              aria-label="Resume upload"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
            </button>
          )}
          
          {canCancel && (
            <button
              onClick={handleCancel}
              className="p-2 text-red-500 hover:text-red-600 transition-colors"
              title="Cancel upload"
              aria-label="Cancel upload"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{upload.progress.toFixed(1)}%</span>
          <span className={getStatusColor()}>
            {getStatusText()}
          </span>
        </div>
        
        <ProgressBar 
          progress={upload.progress} 
          color={getProgressBarColorName()}
          size="md"
        />
      </div>

      {/* Upload Stats */}
      <div className="flex justify-between items-center text-xs text-gray-500">
        <div className="flex items-center space-x-4">
          <span>
            {upload.uploadedChunks} / {upload.totalChunks} chunks
          </span>
          
          {upload.speed > 0 && upload.status === UploadStatus.UPLOADING && (
            <>
              <span>•</span>
              <span>{formatSpeed(upload.speed)}</span>
              <span>•</span>
              <span>ETA: {formatTimeRemaining(upload.remainingTime)}</span>
            </>
          )}
        </div>
        
        {upload.retryCount > 0 && (
          <span className="text-yellow-600">
            Retries: {upload.retryCount}
          </span>
        )}
      </div>

      {/* Error Message */}
      {upload.status === UploadStatus.ERROR && upload.errorMessage && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          {upload.errorMessage}
        </div>
      )}

      {/* Success Message */}
      {upload.status === UploadStatus.COMPLETED && (
        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          Upload completed successfully!
        </div>
      )}
    </div>
  );
}

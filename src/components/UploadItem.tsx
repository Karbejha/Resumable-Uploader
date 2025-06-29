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
  const [isValidating, setIsValidating] = useState(false);

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

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      await uploadManager.validateUpload(upload.id);
    } catch (error) {
      onError?.(error instanceof Error ? error.message : 'Validation failed');
    } finally {
      setIsValidating(false);
    }
  };

  const getStatusColor = () => {
    switch (upload.status) {
      case UploadStatus.UPLOADING:
        return 'text-blue-600';
      case UploadStatus.PAUSED:
        return 'text-yellow-600';
      case UploadStatus.VALIDATING:
        return 'text-purple-600';
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

  const getProgressBarColorName = (): 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple' => {
    if (isPausing || isResuming) return 'yellow';
    
    switch (upload.status) {
      case UploadStatus.UPLOADING:
        return 'blue';
      case UploadStatus.PAUSED:
        return 'yellow';
      case UploadStatus.VALIDATING:
        return 'purple';
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
      case UploadStatus.VALIDATING:
        return 'Validating';
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
          {/* Download button for completed uploads */}
          {upload.status === UploadStatus.COMPLETED && upload.downloadUrl && (
            <a
              href={upload.downloadUrl}
              download={upload.fileName}
              className="p-2 text-green-500 hover:text-green-600 transition-colors"
              title="Download file"
              aria-label="Download file"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </a>
          )}
          
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

          {/* Validate button for completed uploads */}
          {upload.status === UploadStatus.COMPLETED && (
            <button
              onClick={handleValidate}
              disabled={isValidating}
              className="p-2 text-purple-500 hover:text-purple-600 transition-colors disabled:opacity-50"
              title="Validate file integrity"
              aria-label="Validate file integrity"
            >
              {isValidating ? (
                <div className="w-4 h-4 animate-spin rounded-full border-b-2 border-purple-500"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
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

      {/* Success Message with Download Link */}
      {upload.status === UploadStatus.COMPLETED && (
        <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded">
          <div className="flex items-center justify-between">
            <div className="text-sm text-green-700">
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Upload completed successfully!
              </div>
              <div className="text-xs text-green-600 mt-1">
                File size: {formatFileSize(upload.fileSize)}
              </div>
            </div>
            
            {upload.downloadUrl && (
              <a
                href={upload.downloadUrl}
                download={upload.fileName}
                className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                title="Download file"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download
              </a>
            )}
            
            {!upload.downloadUrl && (
              <div className="text-xs text-gray-500">
                Generating download link...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Validation Results */}
      {upload.validationResult && (
        <div className={`mt-3 p-3 rounded-lg border ${
          upload.validationResult.isValid 
            ? 'bg-green-50 border-green-200' 
            : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center">
            {upload.validationResult.isValid ? (
              <>
                <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-green-800">File integrity verified</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium text-red-800">File integrity check failed</span>
              </>
            )}
          </div>
          
          {upload.validationResult.error && (
            <p className="text-xs text-red-600 mt-1 ml-6">
              {upload.validationResult.error}
            </p>
          )}
          
          {upload.validationResult.corruptedChunks && upload.validationResult.corruptedChunks.length > 0 && (
            <p className="text-xs text-red-600 mt-1 ml-6">
              Corrupted chunks: {upload.validationResult.corruptedChunks.join(', ')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

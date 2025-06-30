'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useUploadStore } from '@/store/uploadStore';
import { UploadManager } from '@/services/uploadManager';
import { S3UploadConfig, UploadStatus } from '@/types/upload';
import { formatFileSize, validateFile } from '@/utils/fileUtils';
import { getS3ConfigFromEnv, validateS3Config, logS3Config } from '@/utils/s3Config';
import UploadItem from './UploadItem';
import { getActiveUploads } from '@/utils/uploadUtils';
import { logStorageState } from '@/utils/storageDebug';

// S3 configuration from environment variables
const S3_CONFIG: S3UploadConfig = getS3ConfigFromEnv();

interface FileUploadProps {
  onUploadStart?: (uploadId: string) => void;
  onUploadComplete?: (uploadId: string) => void;
  onUploadError?: (uploadId: string, error: string) => void;
}

export default function FileUpload({ onUploadStart, onUploadComplete, onUploadError }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [uploadManager] = useState(() => new UploadManager(S3_CONFIG));
  const [hasMounted, setHasMounted] = useState(false);
  
  const uploads = useUploadStore((state) => state.uploads);
  const activeUploadIds = useUploadStore((state) => state.activeUploads);
  const activeUploads = getActiveUploads(uploads, activeUploadIds);

  // Validate S3 configuration on component mount
  useEffect(() => {
    const initializeComponent = async () => {
      // First hydrate the store to load persisted data
      await useUploadStore.persist.rehydrate();
      
      setHasMounted(true);
      const validation = validateS3Config(S3_CONFIG);
      if (!validation.isValid) {
        setConfigError(`S3 Configuration Error: ${validation.errors.join(', ')}`);
        console.error('S3 Configuration Issues:', validation.errors);
      } else {
        setConfigError(null);
        if (process.env.NODE_ENV === 'development') {
          logS3Config(S3_CONFIG);
        }
      }

      // Check for uploads that can be resumed after page refresh
      setTimeout(() => {
        checkAndPromptForResume();
      }, 500);
    };

    initializeComponent();
  }, []);

  const checkAndPromptForResume = () => {
    // Log storage state for debugging
    logStorageState();
    
    const allUploads = useUploadStore.getState().uploads;
    const resumableUploads = Object.values(allUploads).filter(upload => 
      (upload.status === UploadStatus.UPLOADING || upload.status === UploadStatus.PAUSED) &&
      upload.progress > 0 && upload.progress < 100
    );

    if (resumableUploads.length > 0) {
      // Show a notification or prompt to the user
      const fileNames = resumableUploads.map(u => u.fileName).join(', ');
      const shouldResume = window.confirm(
        `Found ${resumableUploads.length} interrupted upload(s): ${fileNames}\n\n` +
        'Would you like to select the file(s) again to resume uploading?'
      );

      if (shouldResume) {
        // Mark uploads as waiting for file selection
        resumableUploads.forEach(upload => {
          useUploadStore.getState().updateUpload(upload.id, {
            status: UploadStatus.PAUSED,
            errorMessage: 'Please re-select this file to resume upload',
          });
        });
      } else {
        // User doesn't want to resume, mark as cancelled
        resumableUploads.forEach(upload => {
          useUploadStore.getState().updateUpload(upload.id, {
            status: UploadStatus.CANCELLED,
            errorMessage: 'Upload cancelled by user',
          });
        });
      }
    }
  };

  const handleFileSelect = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0]; // For now, handle one file at a time
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.isValid) {
      alert(validation.error);
      return;
    }

    // Check if this file matches an existing upload that needs to be resumed
    const existingUpload = Object.values(uploads).find(upload => 
      upload.fileName === file.name && 
      upload.fileSize === file.size &&
      (upload.status === UploadStatus.PAUSED || upload.status === UploadStatus.ERROR) &&
      upload.progress > 0
    );

    setIsUploading(true);

    try {
      if (existingUpload) {
        // Resume existing upload
        await uploadManager.resumeUploadWithFile(existingUpload.id, file);
        onUploadStart?.(existingUpload.id);
      } else {
        // Start new upload
        const uploadId = await uploadManager.startUpload(file);
        onUploadStart?.(uploadId);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to start upload';
      alert(errorMessage);
      onUploadError?.('', errorMessage);
    } finally {
      setIsUploading(false);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [uploadManager, onUploadStart, onUploadError, uploads]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      {/* S3 Configuration Error */}
      {configError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-800">Configuration Required</h3>
              <p className="text-sm text-red-700 mt-1">{configError}</p>
              <p className="text-sm text-red-600 mt-2">
                Please check your <code className="bg-red-100 px-1 rounded">.env.local</code> file and see <code className="bg-red-100 px-1 rounded">S3-SETUP.md</code> for setup instructions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Resume Upload Notification */}
      {hasMounted && Object.values(uploads).some(upload => 
        upload.status === UploadStatus.PAUSED && 
        upload.progress > 0 && 
        upload.errorMessage?.includes('re-select')
      ) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-800">Resume Upload</h3>
              <p className="text-sm text-blue-700 mt-1">
                You have interrupted uploads that can be resumed. Select the same file(s) to continue uploading from where you left off.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {!hasMounted && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading...</span>
        </div>
      )}
      
      {hasMounted && (
        <>
          {/* Upload Area */}
          <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleInputChange}
          disabled={isUploading}
          accept="*/*"
          aria-label="Choose file to upload"
          title="Choose file to upload"
        />
        
        <div className="space-y-4">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-900">
              {isUploading ? 'Processing...' : 'Upload your files'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Drag and drop your files here, or{' '}
              <button
                onClick={handleBrowseClick}
                className="text-blue-600 hover:text-blue-700 font-medium"
                disabled={isUploading}
              >
                browse
              </button>
            </p>
          </div>
          
          <div className="text-xs text-gray-400">
            <p>Supported files: All file types</p>
            <p>Maximum file size: 200GB</p>
            <p>Minimum file size: 5MB</p>
          </div>
        </div>
      </div>

      {/* Active Uploads */}
      {activeUploads.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Active Uploads ({activeUploads.length})
          </h3>
          <div className="space-y-4">
            {activeUploads.map((upload) => (
              <UploadItem
                key={upload.id}
                upload={upload}
                uploadManager={uploadManager}
                onComplete={() => onUploadComplete?.(upload.id)}
                onError={(error) => onUploadError?.(upload.id, error)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upload History */}
      {Object.keys(uploads).length > activeUploads.length && (
        <div className="mt-8">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Upload History</h3>
          <div className="space-y-2">
            {Object.values(uploads)
              .filter((upload) => !activeUploads.some((active) => active.id === upload.id))
              .map((upload) => (
                <div
                  key={upload.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{upload.fileName}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(upload.fileSize)} • {upload.status}
                      {upload.status === 'completed' && ' • Ready for download'}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Download button for completed uploads */}
                    {upload.status === 'completed' && upload.downloadUrl && (
                      <a
                        href={upload.downloadUrl}
                        download={upload.fileName}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors mr-2"
                        title="Download file"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download
                      </a>
                    )}
                    
                    {/* Remove button */}
                    <button
                      onClick={() => uploadManager.removeUpload(upload.id)}
                      className="text-gray-400 hover:text-gray-600"
                      title="Remove upload from history"
                      aria-label="Remove upload from history"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
      )}
    </div>
  );
}

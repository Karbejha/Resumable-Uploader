'use client';

import { useState, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';

export default function UploadPage() {
  const [hasMounted, setHasMounted] = useState(false);
  const [uploadStats, setUploadStats] = useState({
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
  });

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleUploadStart = (uploadId: string) => {
    setUploadStats(prev => ({
      ...prev,
      totalUploads: prev.totalUploads + 1,
    }));
  };

  const handleUploadComplete = (uploadId: string) => {
    setUploadStats(prev => ({
      ...prev,
      successfulUploads: prev.successfulUploads + 1,
    }));
  };

  const handleUploadError = (uploadId: string, error: string) => {
    setUploadStats(prev => ({
      ...prev,
      failedUploads: prev.failedUploads + 1,
    }));
  };

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading upload interface...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" suppressHydrationWarning>
      <div className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Resumable File Upload
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Upload large files with confidence. Automatic resume on connection loss, 
              manual pause/resume controls, and real-time progress tracking.
            </p>
          </div>

          {/* Upload Stats */}
          {uploadStats.totalUploads > 0 && (
            <div className="mb-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {uploadStats.totalUploads}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Total Uploads</div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {uploadStats.successfulUploads}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Successful</div>
                  </div>
                </div>
                
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">
                      {uploadStats.failedUploads}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">Failed</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Upload Component */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <FileUpload
              onUploadStart={handleUploadStart}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
            />
          </div>

          {/* Features */}
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
              Key Features
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Auto Resume</h3>
                <p className="text-gray-600">
                  Uploads automatically resume after connection interruptions or browser restarts.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1M7 7h.01M17 7h.01M7 17h.01M17 17h.01" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Manual Controls</h3>
                <p className="text-gray-600">
                  Pause and resume uploads manually with easy-to-use controls.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Large Files</h3>
                <p className="text-gray-600">
                  Support for files up to 200GB with efficient chunked uploads.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Progress Tracking</h3>
                <p className="text-gray-600">
                  Real-time progress indicators with speed and time estimates.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">File Integrity</h3>
                <p className="text-gray-600">
                  Automatic file validation ensures no corruption during upload.
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Background Upload</h3>
                <p className="text-gray-600">
                  Continue browsing while uploads run in the background.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

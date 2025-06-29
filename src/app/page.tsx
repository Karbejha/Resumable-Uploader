'use client';

import React, { useState, useEffect } from 'react';
import FileUpload from '@/components/FileUpload';

export default function HomePage() {
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
        </div>
      </div>
    </div>
  );
}
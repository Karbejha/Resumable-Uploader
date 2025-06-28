/**
 * Debugging utilities for upload persistence
 */

export function logStorageState() {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem('upload-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log('📦 Upload Storage State:', {
        uploadsCount: Object.keys(parsed.state?.uploads || {}).length,
        activeUploadsCount: parsed.state?.activeUploads?.length || 0,
        uploads: parsed.state?.uploads,
        version: parsed.version,
      });
    } else {
      console.log('📦 No upload storage found');
    }
  } catch (error) {
    console.error('📦 Failed to read upload storage:', error);
  }
}

export function clearStorageState() {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('upload-storage');
  console.log('📦 Upload storage cleared');
}

export function getStoredUploads() {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem('upload-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
      return Object.values(parsed.state?.uploads || {});
    }
  } catch (error) {
    console.error('📦 Failed to get stored uploads:', error);
  }
  
  return [];
}

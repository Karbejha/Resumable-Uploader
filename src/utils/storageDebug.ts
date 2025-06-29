/**
 * Debugging utilities for upload persistence
 */

export function logStorageState() {
  if (typeof window === 'undefined') return;
  
  try {
    const stored = localStorage.getItem('upload-storage');
    if (stored) {
      const parsed = JSON.parse(stored);
    } else {
    }
  } catch (error) {
    console.error('📦 Failed to read upload storage:', error);
  }
}

export function clearStorageState() {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('upload-storage');
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

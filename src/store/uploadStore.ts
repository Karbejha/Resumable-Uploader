import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { FileUpload, UploadStatus, UploadProgress, StoredUploadState } from '@/types/upload';

interface UploadStore {
  uploads: { [key: string]: FileUpload };
  activeUploads: string[];
  
  // Actions
  addUpload: (upload: FileUpload) => void;
  updateUpload: (uploadId: string, updates: Partial<FileUpload>) => void;
  updateUploadProgress: (uploadId: string, progress: UploadProgress) => void;
  pauseUpload: (uploadId: string) => void;
  resumeUpload: (uploadId: string) => void;
  cancelUpload: (uploadId: string) => void;
  removeUpload: (uploadId: string) => void;
  setUploadStatus: (uploadId: string, status: UploadStatus) => void;
  markChunkUploaded: (uploadId: string, chunkNumber: number, etag?: string) => void;
  incrementRetryCount: (uploadId: string) => void;
  
  // Getters (simple functions that don't cause reactivity issues)
  getUpload: (uploadId: string) => FileUpload | undefined;
  
  // Storage management
  clearCompletedUploads: () => void;
  clearAllUploads: () => void;
}

export const useUploadStore = create<UploadStore>()(
  persist(
    (set, get) => ({
      uploads: {},
      activeUploads: [],

      addUpload: (upload: FileUpload) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [upload.id]: upload,
          },
          activeUploads: [...state.activeUploads, upload.id],
        }));
      },

      updateUpload: (uploadId: string, updates: Partial<FileUpload>) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              ...updates,
              updatedAt: new Date(),
            },
          },
        }));
      },

      updateUploadProgress: (uploadId: string, progress: UploadProgress) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              progress: progress.progress,
              speed: progress.speed,
              remainingTime: progress.remainingTime,
              status: progress.status,
              updatedAt: new Date(),
            },
          },
        }));
      },

      pauseUpload: (uploadId: string) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              status: UploadStatus.PAUSED,
              updatedAt: new Date(),
            },
          },
        }));
      },

      resumeUpload: (uploadId: string) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              status: UploadStatus.RESUMING,
              updatedAt: new Date(),
            },
          },
        }));
      },

      cancelUpload: (uploadId: string) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              status: UploadStatus.CANCELLED,
              updatedAt: new Date(),
            },
          },
          activeUploads: state.activeUploads.filter(id => id !== uploadId),
        }));
      },

      removeUpload: (uploadId: string) => {
        set((state) => {
          const { [uploadId]: removed, ...remainingUploads } = state.uploads;
          return {
            uploads: remainingUploads,
            activeUploads: state.activeUploads.filter(id => id !== uploadId),
          };
        });
      },

      setUploadStatus: (uploadId: string, status: UploadStatus) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              status,
              updatedAt: new Date(),
            },
          },
        }));
      },

      markChunkUploaded: (uploadId: string, chunkNumber: number, etag?: string) => {
        set((state) => {
          const upload = state.uploads[uploadId];
          if (!upload) return state;

          const updatedChunks = upload.chunks.map(chunk =>
            chunk.chunkNumber === chunkNumber
              ? { ...chunk, uploaded: true, etag }
              : chunk
          );

          const uploadedChunks = updatedChunks.filter(chunk => chunk.uploaded).length;
          const progress = (uploadedChunks / upload.totalChunks) * 100;

          return {
            uploads: {
              ...state.uploads,
              [uploadId]: {
                ...upload,
                chunks: updatedChunks,
                uploadedChunks,
                progress,
                updatedAt: new Date(),
              },
            },
          };
        });
      },

      incrementRetryCount: (uploadId: string) => {
        set((state) => ({
          uploads: {
            ...state.uploads,
            [uploadId]: {
              ...state.uploads[uploadId],
              retryCount: state.uploads[uploadId].retryCount + 1,
              updatedAt: new Date(),
            },
          },
        }));
      },

      getUpload: (uploadId: string) => {
        return get().uploads[uploadId];
      },

      clearCompletedUploads: () => {
        set((state) => {
          const completedIds = Object.keys(state.uploads).filter(
            id => state.uploads[id].status === UploadStatus.COMPLETED
          );
          
          const newUploads = { ...state.uploads };
          completedIds.forEach(id => delete newUploads[id]);
          
          return {
            uploads: newUploads,
            activeUploads: state.activeUploads.filter(id => !completedIds.includes(id)),
          };
        });
      },

      clearAllUploads: () => {
        set({
          uploads: {},
          activeUploads: [],
        });
      },
    }),
    {
      name: 'upload-storage',
      storage: createJSONStorage(() => typeof window !== 'undefined' ? localStorage : {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      }),
      partialize: (state) => ({
        uploads: Object.fromEntries(
          Object.entries(state.uploads).map(([id, upload]) => [
            id,
            {
              ...upload,
              // Remove non-serializable properties for localStorage
              file: undefined,
              chunks: upload.chunks.map(chunk => ({
                chunkNumber: chunk.chunkNumber,
                chunkSize: chunk.chunkSize,
                startByte: chunk.startByte,
                endByte: chunk.endByte,
                etag: chunk.etag,
                uploaded: chunk.uploaded,
                // Remove chunkData (Blob) as it's not serializable
                chunkData: undefined,
              })),
            },
          ])
        ),
        activeUploads: state.activeUploads,
      }),
      skipHydration: true,
    }
  )
);

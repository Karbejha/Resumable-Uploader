'use client';

import { useEffect, useState } from 'react';
import { useUploadStore } from '@/store/uploadStore';

interface StoreHydrationProps {
  children: React.ReactNode;
}

export default function StoreHydration({ children }: StoreHydrationProps) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const hydrateStore = async () => {
      try {
        // Rehydrate the upload store from localStorage
        await useUploadStore.persist.rehydrate();
        setHydrated(true);
      } catch (error) {
        console.error('Failed to hydrate store:', error);
        setHydrated(true); // Continue anyway
      }
    };

    hydrateStore();
  }, []);

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading...</span>
      </div>
    );
  }

  return <>{children}</>;
}

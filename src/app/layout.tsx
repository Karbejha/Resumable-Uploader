import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import StoreHydration from '@/components/StoreHydration'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Resumable File Upload',
  description: 'Upload large files with resumable functionality, progress tracking, and session persistence.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <StoreHydration>
          <main>
            {children}
          </main>
        </StoreHydration>
      </body>
    </html>
  )
}

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a Next.js TypeScript project for a resumable file upload system with the following key features:

## Project Requirements
- Resumable file uploads to S3 with chunking
- Manual pause/resume functionality
- Upload progress tracking and persistence
- Session persistence across browser restarts
- File integrity validation
- Support for files from 5MB to 200GB
- Background uploads while navigating between pages
- Real-time progress indicators
- Robust error handling and retry mechanisms

## Tech Stack
- Next.js 15 with App Router
- TypeScript
- Tailwind CSS
- AWS SDK for S3 uploads
- Zustand for state management
- Local Storage for persistence
- Crypto-JS for file integrity checks

## Architecture Principles
- Use chunked uploads for large files
- Implement proper error boundaries
- Store upload state in local storage
- Use Web Workers for heavy operations when needed
- Follow React best practices and hooks patterns
- Implement proper TypeScript types
- Use server-side API routes for S3 operations

Please generate code that follows these patterns and implements the resumable upload functionality with all specified requirements.

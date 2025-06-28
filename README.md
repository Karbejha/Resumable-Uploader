# Resumable File Upload System

A focused Next.js application dedicated to demonstrating robust resumable file upload functionality with all the core requirements for large file handling.

## Project Focus

This application is specifically designed to showcase:
- **Resumable file uploads** with automatic and manual resume capabilities
- **Chunked upload processing** for files ranging from 5MB to 200GB
- **Session persistence** that survives browser restarts and navigation
- **Real-time progress tracking** with speed and time estimates
- **File integrity validation** using checksum verification
- **Robust error handling** with retry mechanisms

## Core Features

### 🔄 Resumable Upload Technology
- ✅ **Automatic Resume**: Uploads continue after connection interruptions
- ✅ **Manual Pause/Resume**: User-controlled upload management
- ✅ **Browser Restart Recovery**: State persists across browser sessions
- ✅ **Navigation Tolerance**: Background uploads during page navigation

### 📊 Progress & Monitoring
- ✅ **Real-time Progress**: Live progress bars with percentage completion
- ✅ **Upload Statistics**: Track total, successful, and failed uploads
- ✅ **Speed Indicators**: Real-time upload speed and ETA calculations
- ✅ **Chunk-level Tracking**: Monitor individual chunk upload progress

### 🛡️ Reliability & Integrity
- ✅ **File Integrity**: SHA-256 checksum validation
- ✅ **Error Recovery**: Automatic retry with exponential backoff
- ✅ **Connection Resilience**: Handles network interruptions gracefully
- ✅ **Large File Support**: Efficiently handles files up to 200GB

### ⚡ Performance Optimization
- ✅ **Chunked Processing**: Files split into optimal chunks (5MB-100MB)
- ✅ **Parallel Uploads**: Multiple chunks uploaded simultaneously
- ✅ **Memory Efficiency**: Streaming approach for large files
- ✅ **Background Processing**: Non-blocking upload operations

## Tech Stack

- **Frontend**: Next.js 15 with App Router, React, TypeScript
- **State Management**: Zustand with localStorage persistence
- **File Upload**: AWS S3 SDK with multipart uploads
- **Styling**: Tailwind CSS for responsive design
- **File Processing**: Crypto-JS for integrity validation
- **Development**: ESLint, PostCSS

## Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd upload-project
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   
   Edit `.env.local` with your AWS S3 credentials:
   ```env
   NEXT_PUBLIC_S3_BUCKET=uploader-name
   NEXT_PUBLIC_S3_REGION=eu-north-1
   NEXT_PUBLIC_S3_ACCESS_KEY=your-access-key-id
   NEXT_PUBLIC_S3_SECRET_KEY=your-secret-access-key
   ```

4. **Configure S3 bucket** (see S3-SETUP.md for detailed instructions):
   - Set up CORS policy for web uploads
   - Configure IAM permissions for multipart uploads
   - Test bucket access

5. **Run the development server**:
   ```bash
   npm run dev
   ```

6. **Open [http://localhost:3001](http://localhost:3001)** in your browser.

## Usage

### Basic Upload
1. Navigate to the Upload page
2. Drag and drop a file or click to browse
3. Monitor real-time progress with speed and ETA
4. Files are automatically chunked and uploaded in parallel

### Resumable Uploads
- **Automatic Resume**: If connection is lost, uploads resume automatically when restored
- **Manual Pause**: Click the pause button to temporarily stop an upload
- **Manual Resume**: Click the resume button to continue a paused upload
- **Session Persistence**: Close the browser and uploads will resume when you return

### Navigation During Upload
- Upload progress is shown in the global indicator at the top
- Navigate between pages while uploads continue in the background
- Return to the Upload page to see detailed progress

## Project Structure

```
src/
├── app/                    # Next.js 13+ app directory
│   ├── api/               # API routes
│   ├── upload/            # Upload page
│   ├── gallery/           # Demo gallery page
│   ├── documents/         # Demo documents page
│   ├── settings/          # Demo settings page
│   ├── about/             # About page
│   ├── layout.tsx         # Root layout with navigation
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── FileUpload.tsx     # Main upload component
│   ├── UploadItem.tsx     # Individual upload item
│   ├── GlobalUploadIndicator.tsx  # Top progress bar
│   └── Navigation.tsx     # Navigation component
├── services/              # Business logic
│   ├── uploadManager.ts   # Main upload orchestration
│   └── s3UploadService.ts # AWS S3 integration
├── store/                 # State management
│   └── uploadStore.ts     # Zustand store with persistence
├── types/                 # TypeScript definitions
│   └── upload.ts          # Upload-related types
└── utils/                 # Utility functions
    └── fileUtils.ts       # File processing utilities
```

## Configuration

### Upload Settings
- **Chunk Size**: Configurable from 5MB to 100MB (default: 5MB)
- **Concurrent Uploads**: 1-5 parallel chunks (default: 3)
- **Retry Attempts**: Number of retry attempts for failed chunks (default: 3)
- **File Size Limits**: 5MB minimum, 200GB maximum

### AWS S3 Setup
1. Create an S3 bucket with appropriate permissions
2. Enable CORS for web uploads:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "POST", "PUT"],
       "AllowedOrigins": ["http://localhost:3000"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
3. Configure IAM user with S3 upload permissions

## API Endpoints

### POST /api/upload
Initialize a new upload session.

**Request**:
```json
{
  "filename": "large-file.zip",
  "filesize": 1073741824,
  "filetype": "application/zip"
}
```

**Response**:
```json
{
  "uploadId": "upload-123-abc",
  "uploadUrl": "https://bucket.s3.amazonaws.com/large-file.zip"
}
```

### GET/POST /api/validate
Validate file integrity after upload.

## Testing Scenarios

The application has been tested under various scenarios:

### Network Conditions
- ✅ Intermittent connectivity
- ✅ Complete network loss
- ✅ Slow connections
- ✅ Connection timeouts

### Browser Scenarios
- ✅ Tab closure and reopening
- ✅ Browser restart
- ✅ Page refresh during upload
- ✅ Navigation between pages

### File Types
- ✅ Large video files (>1GB)
- ✅ Archive files (.zip, .tar.gz)
- ✅ Documents (.pdf, .docx)
- ✅ Images and media files

### Error Conditions
- ✅ Server errors (5xx)
- ✅ Authentication failures
- ✅ Storage quota exceeded
- ✅ File corruption detection

## Browser Support

- **Chrome**: 88+
- **Firefox**: 85+
- **Safari**: 14+
- **Edge**: 88+

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Adding New Features

1. **State Management**: Use Zustand store for UI state
2. **Persistence**: Leverage localStorage for session persistence
3. **Error Handling**: Implement proper error boundaries
4. **Types**: Add TypeScript interfaces for new features

## Security Considerations

- **File Validation**: All uploads are validated for size and type
- **Checksum Verification**: File integrity is verified post-upload
- **CORS Configuration**: Properly configured for secure uploads
- **Access Control**: Implement proper IAM policies for S3 access

## Performance Optimization

- **Chunked Uploads**: Parallel processing for faster uploads
- **Compression**: Automatic compression for applicable file types
- **Caching**: Efficient state management with minimal re-renders
- **Memory Management**: Proper cleanup of file references

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is for demonstration purposes. Please check with the appropriate licenses for production use.

## Support

For questions or issues, please create an issue in the repository or contact the development team.

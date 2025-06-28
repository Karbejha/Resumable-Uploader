# S3 Bucket Configuration Guide

## Current Configuration
- **Bucket Name**: uploader-name
- **Region**: eu-north-1 (Stockholm)
- **Access Key**: AKIAXW35EKTSZ2IAVRGH

## Required S3 Bucket Setup

### 1. CORS Configuration
Add this CORS configuration to your S3 bucket to allow web uploads:

```json
[
    {
        "AllowedHeaders": [
            "*"
        ],
        "AllowedMethods": [
            "GET",
            "POST",
            "PUT",
            "DELETE",
            "HEAD"
        ],
        "AllowedOrigins": [
            "http://localhost:3000",
            "http://localhost:3001",
            "https://your-domain.com"
        ],
        "ExposeHeaders": [
            "ETag",
            "x-amz-meta-custom-header"
        ],
        "MaxAgeSeconds": 3000
    }
]
```

### 2. IAM User Permissions
Your IAM user needs these permissions for the bucket:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListMultipartUploadParts",
                "s3:AbortMultipartUpload",
                "s3:CreateMultipartUpload",
                "s3:CompleteMultipartUpload"
            ],
            "Resource": "arn:aws:s3:::uploader-name/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::uploader-name"
        }
    ]
}
```

### 3. Bucket Settings
- **Public Access Block**: Can be enabled (uploads will work with signed URLs)
- **Versioning**: Optional (recommended for data protection)
- **Encryption**: Recommended (AES-256 or KMS)

## How to Configure

### Step 1: CORS Configuration
1. Go to AWS S3 Console
2. Select your bucket "uploader-name"
3. Go to "Permissions" tab
4. Scroll down to "Cross-origin resource sharing (CORS)"
5. Click "Edit" and paste the CORS JSON above
6. Save changes

### Step 2: IAM Permissions
1. Go to AWS IAM Console
2. Find your IAM user (the one with access key AKIAXW35EKTSZ2IAVRGH)
3. Go to "Permissions" tab
4. Click "Add inline policy"
5. Choose JSON tab and paste the permissions above
6. Name the policy "S3-Upload-Policy"
7. Create policy

### Step 3: Test Connection
After configuration, restart the development server:
```bash
npm run dev
```

The application will now use your real S3 bucket for uploads!

## Security Notes

⚠️ **Important Security Considerations**:

1. **Environment Variables**: Your credentials are now in `.env.local` which is gitignored
2. **CORS Origins**: Update the allowed origins to match your production domain
3. **IAM Permissions**: The user has minimal required permissions for uploads only
4. **Access Keys**: Consider using IAM roles instead of access keys in production

## Testing

Once configured, you can test:
1. Upload a file through the web interface
2. Check the S3 bucket to see the uploaded chunks
3. Verify multipart uploads are working correctly
4. Test pause/resume functionality

The upload system will now work with real S3 storage!

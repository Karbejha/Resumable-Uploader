import { S3UploadConfig } from '@/types/upload';

export function validateS3Config(config: S3UploadConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.bucketName || config.bucketName === 'your-bucket-name') {
    errors.push('S3 bucket name is not configured');
  }

  if (!config.region || config.region === 'us-east-1') {
    // Note: us-east-1 is a valid region, but we're checking for default placeholder
    if (config.bucketName === 'your-bucket-name') {
      errors.push('S3 region is not configured');
    }
  }

  if (!config.accessKeyId || config.accessKeyId === 'your-access-key' || config.accessKeyId.length < 16) {
    errors.push('S3 access key ID is not configured or invalid');
  }

  if (!config.secretAccessKey || config.secretAccessKey === 'your-secret-key' || config.secretAccessKey.length < 32) {
    errors.push('S3 secret access key is not configured or invalid');
  }

  if (config.chunkSize < 5 * 1024 * 1024) {
    errors.push('Chunk size must be at least 5MB for S3 multipart uploads');
  }

  if (config.maxConcurrentUploads < 1 || config.maxConcurrentUploads > 10) {
    errors.push('Max concurrent uploads must be between 1 and 10');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function getS3ConfigFromEnv(): S3UploadConfig {
  return {
    bucketName: process.env.NEXT_PUBLIC_S3_BUCKET || '',
    region: process.env.NEXT_PUBLIC_S3_REGION || '',
    accessKeyId: process.env.NEXT_PUBLIC_S3_ACCESS_KEY || '',
    secretAccessKey: process.env.NEXT_PUBLIC_S3_SECRET_KEY || '',
    chunkSize: parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHUNK_SIZE || '5242880'),
    maxConcurrentUploads: parseInt(process.env.NEXT_PUBLIC_MAX_CONCURRENT_UPLOADS || '3'),
    retryAttempts: parseInt(process.env.NEXT_PUBLIC_RETRY_ATTEMPTS || '3'),
  };
}

export function logS3Config(config: S3UploadConfig): void {
  const validation = validateS3Config(config);
  
  console.log('🔧 S3 Upload Configuration:');
  console.log(`   Bucket: ${config.bucketName}`);
  console.log(`   Region: ${config.region}`);
  console.log(`   Access Key: ${config.accessKeyId.substring(0, 8)}...`);
  console.log(`   Chunk Size: ${(config.chunkSize / 1024 / 1024).toFixed(1)}MB`);
  console.log(`   Max Concurrent: ${config.maxConcurrentUploads}`);
  console.log(`   Retry Attempts: ${config.retryAttempts}`);
  
  if (validation.isValid) {
    console.log('✅ S3 configuration is valid');
  } else {
    console.warn('⚠️ S3 configuration issues:');
    validation.errors.forEach(error => console.warn(`   - ${error}`));
  }
}

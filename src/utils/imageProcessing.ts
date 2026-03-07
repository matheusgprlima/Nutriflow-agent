
export const MAX_FILE_SIZE_MB = 25;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
export const TARGET_COMPRESSION_SIZE_MB = 1.5;
export const TARGET_COMPRESSION_SIZE_BYTES = TARGET_COMPRESSION_SIZE_MB * 1024 * 1024;
export const MAX_DIMENSION = 1920;
export const COMPRESSION_QUALITY = 0.75;

export type FileStatus = 'pending' | 'compressing' | 'uploading' | 'completed' | 'error';

export interface ProcessedFile {
  id: string;
  originalFile: File;
  compressedBlob?: Blob;
  status: FileStatus;
  progress: number;
  error?: string;
  category: 'diet' | 'metrics' | 'bioimpedance' | 'training';
  uploadResult?: {
    filename: string;
    id: string;
  };
}

export async function processImage(file: File): Promise<Blob> {
  // 1. Validation
  if (file.size === 0) throw new Error('File is empty');
  if (file.size > MAX_FILE_SIZE_BYTES) throw new Error(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit`);

  // 2. Check if compression is needed
  // If it's already small enough and a supported web format, skip heavy processing
  // But we still might want to resize if dimensions are huge.
  // For simplicity, we'll try to process everything that is an image to ensure consistency.
  
  // Skip unsupported formats for client-side processing (HEIC, TIFF, BMP often fail in canvas)
  // We'll just return the original file and let the server handle/reject it or store it as is.
  const supportedFormats = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!supportedFormats.includes(file.type)) {
    console.warn('Format not supported for client-side compression, uploading original:', file.type);
    return file; 
  }

  // 3. Load Image
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    console.warn('createImageBitmap failed, falling back to original file', e);
    return file;
  }

  // 4. Calculate new dimensions
  let { width, height } = bitmap;
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  } else if (file.size <= TARGET_COMPRESSION_SIZE_BYTES) {
    // Small enough and dimensions are okay? Return original to avoid re-compression artifacts
    // unless it's a format we definitely want to convert (like huge PNGs to JPG)
    if (file.type === 'image/jpeg' || file.type === 'image/webp') {
      bitmap.close();
      return file;
    }
  }

  // 5. Draw to Canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Canvas context not available');
  }
  
  // Fill white background for transparent images (conversion to JPEG)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 6. Compress
  // Prefer WebP or JPEG
  const mimeType = 'image/jpeg'; 
  
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Compression failed'));
        }
      },
      mimeType,
      COMPRESSION_QUALITY
    );
  });
}

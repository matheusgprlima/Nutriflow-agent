import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DateTime } from 'luxon';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_ROOT)) {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

export const saveFile = async (file: Express.Multer.File, category: string, timezone: string): Promise<string> => {
  const dt = DateTime.now().setZone(timezone);
  const localDate = (dt.isValid ? dt.toISODate() : DateTime.now().toISODate()) || 'unknown-date'; // Fallback
  const uploadDir = path.join(UPLOAD_ROOT, localDate, category);

  if (!fs.existsSync(uploadDir)) {
    await fs.promises.mkdir(uploadDir, { recursive: true });
  }

  const ext = path.extname(file.originalname) || '.jpg'; // Default to jpg if missing
  const filename = `${crypto.randomUUID()}${ext}`;
  const filepath = path.join(uploadDir, filename);

  await fs.promises.writeFile(filepath, file.buffer);
  
  return filepath;
};

export const getFile = (filepath: string) => {
  // Ensure we don't traverse out of uploads
  if (!filepath.startsWith(UPLOAD_ROOT)) {
    throw new Error('Access denied');
  }
  return filepath;
};

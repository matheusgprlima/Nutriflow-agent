import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const saveFile = async (file: Express.Multer.File): Promise<string> => {
  const ext = path.extname(file.originalname);
  const filename = `${crypto.randomUUID()}${ext}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  await fs.promises.writeFile(filepath, file.buffer);
  
  // Return a relative path or URL that the frontend can use if we serve static files
  // For internal processing, we return the absolute path
  return filepath;
};

export const getFile = (filename: string) => {
  return path.join(UPLOAD_DIR, filename);
};

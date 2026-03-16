import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(process.cwd(), 'logs');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

export function logError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const filePath = path.join(LOG_DIR, `${timestamp.slice(0, 10)}.log`);

  const base: Record<string, unknown> = { timestamp, context };
  if (error instanceof Error) {
    base.message = error.message;
    base.stack = error.stack;
  } else {
    base.message = String(error);
  }
  if (extra && Object.keys(extra).length > 0) base.extra = extra;

  fs.promises.appendFile(filePath, JSON.stringify(base) + '\n', 'utf8').catch((e) => {
    console.error('[logger] write failed', e);
  });
}

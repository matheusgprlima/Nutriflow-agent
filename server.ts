import 'dotenv/config';
import http from 'http';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachWs } from './server/ws.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

async function startServer() {
  const app = express();

  app.use(express.json({ limit: '1kb' }));

  app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Server Error:', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: err?.message || 'Internal Server Error' });
  });

  const server = http.createServer(app);
  attachWs(server);

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT} (WS: /ws)`);
  });
}

startServer();

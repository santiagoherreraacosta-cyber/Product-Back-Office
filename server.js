import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getContextDocuments, updateContextDocument } from './src/contextStore.js';

const PORT = process.env.PORT || 8000;
const ROOT = process.cwd();
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === 'GET' && url.pathname === '/api/context') return json(res, await getContextDocuments());
    if (req.method === 'PATCH' && url.pathname.startsWith('/api/context/')) {
      const id = decodeURIComponent(url.pathname.split('/').pop());
      const body = await readJson(req);
      return json(res, await updateContextDocument(id, body, req.headers['x-admin-role']));
    }
    if (req.method !== 'GET') return json(res, { error: 'Método no soportado.' }, 405);
    const requested = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = path.normalize(path.join(ROOT, requested));
    if (!filePath.startsWith(ROOT)) return json(res, { error: 'Ruta inválida.' }, 400);
    const content = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(content);
  } catch (error) {
    if (error.code === 'ENOENT') return json(res, { error: 'No encontrado.' }, 404);
    json(res, { error: error.message }, error.statusCode || 500);
  }
}).listen(PORT, '0.0.0.0', () => console.log(`Dropi Product Assistant en http://0.0.0.0:${PORT}`));

function json(res, payload, status = 200) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(payload)); }
async function readJson(req) { const chunks = []; for await (const chunk of req) chunks.push(chunk); return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}; }

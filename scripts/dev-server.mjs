// Zero-dependency static server that mirrors firebase.json (clean URLs + rewrites).
// Usage: npm run dev   ->  http://localhost:5173
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 5173;
const types = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.ico': 'image/x-icon', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.mp4': 'video/mp4'
};

function rewrite(path) {
    if (path === '/') return '/index.html';
    if (path.startsWith('/product/')) return '/product.html';
    if (path.startsWith('/collections/')) return '/shop.html';
    if (path === '/admin' || path === '/admin/') return '/admin/index.html';
    if (!extname(path)) return path + '.html';
    return path;
}

createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let rel = decodeURIComponent(url.pathname);
    const file = normalize(join(root, rewrite(rel)));
    if (!file.startsWith(root)) { res.writeHead(403).end('Forbidden'); return; }
    try {
        const s = await stat(file);
        if (!s.isFile()) throw new Error('not a file');
        res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(await readFile(file));
    } catch {
        try {
            res.writeHead(404, { 'Content-Type': types['.html'] });
            res.end(await readFile(join(root, '404.html')));
        } catch { res.writeHead(404).end('Not found'); }
    }
}).listen(port, () => console.log(`Seaway dev server: http://localhost:${port}  (admin: /admin/login)`));

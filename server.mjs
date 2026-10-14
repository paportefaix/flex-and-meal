// Serveur local de l'application construite (npm start / flex-and-meal.bat).
// Sert dist/flex-and-meal/browser et relaie /off-search et /hevy-api, car Open Food Facts et Hevy
// n'envoient pas d'en-têtes CORS (même rôle que proxy.conf.json en développement).
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), 'dist', 'flex-and-meal', 'browser');
const PORT = 5173;

const PROXIES = [
  { prefix: '/off-search', target: 'https://search.openfoodfacts.org/search', headers: { 'user-agent': 'flex-and-meal/0.1 (usage personnel)' } },
  { prefix: '/hevy-api', target: 'https://api.hevyapp.com', headers: {} },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.txt': 'text/plain; charset=utf-8',
};

async function proxy(req, res, { prefix, target, headers }) {
  const url = target + req.url.slice(prefix.length);
  const forwarded = { ...Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'connection', 'origin', 'referer', 'content-length'].includes(k))), ...headers };
  try {
    const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(await Array.fromAsync(req));
    const upstream = await fetch(url, { method: req.method, headers: forwarded, body });
    res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') ?? 'application/octet-stream' });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (e) {
    res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`Service injoignable : ${e.message}`);
  }
}

const server = createServer((req, res) => {
  const proxied = PROXIES.find((p) => req.url === p.prefix || req.url.startsWith(p.prefix + '/') || req.url.startsWith(p.prefix + '?'));
  if (proxied) return void proxy(req, res, proxied);

  const path = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  let file = join(ROOT, path);
  if (!file.startsWith(ROOT)) {
    res.writeHead(403).end();
    return;
  }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
});

server.on('error', (e) => {
  console.error(e.code === 'EADDRINUSE' ? `Le port ${PORT} est déjà utilisé.` : e);
  process.exit(1);
});

server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`;
  console.log(`Flex & Meal : ${url}`);
  if (process.argv.includes('--open')) {
    const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
    spawn(cmd, args, { stdio: 'ignore', detached: true }).unref();
  }
});

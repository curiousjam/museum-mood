import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost:3001');
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const base = name.startsWith('art/motion/')
      ? path.join(root, 'public')
      : path.join(root, 'outputs/motion-test');
    const file = path.resolve(base, name);
    if (!file.startsWith(base + path.sep)) throw Error('invalid path');
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': file.endsWith('.js')
        ? 'text/javascript'
        : file.endsWith('.css')
          ? 'text/css'
          : file.endsWith('.jpg')
            ? 'image/jpeg'
            : 'text/html',
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(3001, '127.0.0.1', () =>
  console.log('Fixture: http://127.0.0.1:3001/'),
);

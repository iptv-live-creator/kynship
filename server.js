// Local Node.js server for Kynship — serves static files and handles save & upload
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf'
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Img-Name, X-Mode');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  let pathname = parsedUrl.pathname;

  // Save / Upload endpoints (handles both upload.php and /api/save)
  if (req.method === 'POST' && (pathname === '/upload.php' || pathname === '/api/save')) {
    const mode = req.headers['x-mode'] || 'img';

    if (mode === 'save') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const json = JSON.parse(body);
          const pretty = JSON.stringify(json, null, 2);
          fs.writeFileSync(path.join(ROOT, 'content.json'), pretty, 'utf8');
          console.log('[Kynship Server] content.json updated successfully on disk!');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, msg: 'Saved to content.json on disk' }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, err: err.message }));
        }
      });
      return;
    }

    // File / Image / Font Upload
    let uploadName = req.headers['x-img-name'] || ('upload_' + Date.now());
    uploadName = uploadName.replace(/[^a-zA-Z0-9_.-]/g, '');
    const isFont = mode === 'font' || /\.(woff2?|ttf|otf)$/i.test(uploadName);
    const targetDir = isFont ? path.join(ROOT, 'fonts') : path.join(ROOT, 'images');
    const urlPrefix = isFont ? 'fonts/' : 'images/';

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const filePath = path.join(targetDir, uploadName);
        fs.writeFileSync(filePath, buffer);
        console.log('[Kynship Server] File saved:', urlPrefix + uploadName);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, url: urlPrefix + uploadName, isFont }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, err: err.message }));
      }
    });
    return;
  }

  // Serve static files
  if (pathname === '/' || pathname === '') pathname = '/index.html';
  const filePath = path.join(ROOT, pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`[Kynship Server] Running at http://localhost:${PORT}/`);
  console.log(`[Kynship Server] Website: http://localhost:${PORT}/index.html`);
  console.log(`[Kynship Server] Admin:   http://localhost:${PORT}/admin.html`);
});

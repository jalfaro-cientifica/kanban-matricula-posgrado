// Local Development Server
require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const tasksHandler = require('./api/tasks');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Delegate /api/tasks to our serverless handler
  if (pathname === '/api/tasks' || pathname.startsWith('/api/tasks/')) {
    // Adapter for serverless handler
    req.query = parsedUrl.query;
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(data));
    };

    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', () => {
      req.body = body;
      tasksHandler(req, res);
    });
    return;
  }

  // Serve static files from public/
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
  };

  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(` TABLERO MATRÍCULA POSGRADO — SERVIDOR LOCAL MONGODB ATLAS`);
  console.log('================================================================');
  console.log(` Base de datos: MongoDB Atlas (${process.env.MONGODB_DB || 'matricula_posgrado'})`);
  console.log(` URL Local: http://localhost:${PORT}`);
  console.log(' Los cambios se sincronizan en tiempo real con MongoDB Atlas.');
  console.log(' Presiona Ctrl+C para detener el servidor.');
  console.log('================================================================\n');
});

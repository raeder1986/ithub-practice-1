require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { Worker } = require('worker_threads');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const keywordsToUrls = {
    'tinycore': ['http://www.tinycorelinux.net/15.x/x86/release/Core-current.iso', 'http://www.tinycorelinux.net/14.x/x86/archive/14.0/Core-14.0.iso', 'http://www.tinycorelinux.net/13.x/x86/archive/13.1/Core-13.1.iso'],
    'slitaz': ['https://download.tuxfamily.org/slitaz/iso/5.0-rc/slitaz-5.0-rc3.iso', 'https://download.tuxfamily.org/slitaz/iso/stable/slitaz-4.0.iso', 'https://download.tuxfamily.org/slitaz/iso/latest/slitaz-rolling-core64.iso'],
    'alpine': ['https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/x86/alpine-standard-3.20.0-x86.iso', 'https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/x86_64/alpine-standard-3.20.0-x86_64.iso', 'https://dl-cdn.alpinelinux.org/alpine/v3.20/releases/x86_64/alpine-virt-3.20.0-x86_64.iso']
};

let activeWorkers = 0;
let threadId = 1;
let queuedDownloads = [];
const maxWorkers = process.env.MAX_WORKERS;
const speedLimit = parseInt(process.env.SPEED_LIMIT) * 1024;

wss.on('connection', (ws) => {
  ws.on('message', async (message) => {
    const { type, keyword, url } = JSON.parse(message);

    if (type === 'get_urls') {
      if (keywordsToUrls[keyword]) {
        ws.send(JSON.stringify({ type: 'url_list', urls: keywordsToUrls[keyword] }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Keyword not found' }));
      }
    } else if (type === 'download') {
      const filePath = path.join(__dirname, 'public', path.basename(url));
      
      if (!fs.existsSync(path.dirname(filePath))) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
      }        
      if (activeWorkers < maxWorkers) {
        startDownload(ws, url, filePath);
      } else {
        queuedDownloads.push(() => startDownload(ws, url, filePath));
      }
    }
  });
});

const startDownload = (ws, url, filePath) => {
  activeWorkers++;
  threadId++;
  ws.send(JSON.stringify({ type: 'worker_count', threadId, activeWorkers, maxWorkers }));

  const worker = new Worker('./worker.js', {
    workerData: { url, filePath, threadId, speedLimit }
  });

  worker.on('message', (message) => {
    if (message.type === 'progress') {
      ws.send(JSON.stringify({ type: 'progress', ...message, threadId: message.threadId, fileName: message.fileName  }));
    } else if (message.type === 'complete') {
      ws.send(JSON.stringify({ type: 'complete', fileName: message.fileName }));
    }
  });

  worker.on('error', (error) => {
    ws.send(JSON.stringify({ type: 'error', message: error.message }));
  });

  worker.on('exit', (code) => {
    activeWorkers--;
    threadIdFake = 0;
    ws.send(JSON.stringify({ type: 'worker_count', threadIdFake, activeWorkers, maxWorkers }));

    if (code !== 0) {
      ws.send(JSON.stringify({ type: 'error', message: `Worker stopped with exit code ${code}` }));
    }

    if (activeWorkers < maxWorkers && queuedDownloads.length > 0) {
      const nextDownload = queuedDownloads.shift();
      nextDownload();
    }
  });
};

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Waiting for download');
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
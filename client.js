const serverIp = "40.68.204.185"
//const serverIp = "localhost"


const ws = new WebSocket(`ws://${serverIp}:8080`);
const serverURL = `http://${serverIp}:8080/`;

ws.onopen = () => {
  console.log('Connected to server');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  switch(message.type) {
    case 'url_list':
      const urlList = document.getElementById('urlList');
      urlList.innerHTML = '';
      message.urls.forEach((url) => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.textContent = 'Download to server';
        button.onclick = () => downloadContentServer(url);
        li.textContent = ` ${url}`;
        li.appendChild(button);
        urlList.appendChild(li);
      });
      break;
    case 'progress':
      const downloadStatusEach = document.getElementById(`thread-${message.threadId}`);
      downloadStatusEach.textContent = `File: ${message.fileName}, Progress: ${message.progress.toFixed(2)}%, Downloaded to server: ${message.downloadedLength} / ${message.contentLength}`;
      break;
    case 'worker_count':
      const workerCount = document.getElementById('workerCount');
      workerCount.textContent = `Active Workers: ${message.activeWorkers} / ${message.maxWorkers}`;
      if (message.threadId > 0) {
        const downloadStatus = document.getElementById('downloadStatus');
        const li = document.createElement('li');
        li.id = `thread-${message.threadId}`;
        downloadStatus.appendChild(li);
      }
      break;
    case 'complete':
      const downloadedContent = document.getElementById('downloadedContent');
      const li = document.createElement('li');
      const button = document.createElement('button');
      button.textContent = `Download to client`;
      button.onclick = () => downloadContentClient(message.fileName);
      li.textContent = `${message.fileName} ready to download to client `;
      li.appendChild(button);
      downloadedContent.appendChild(li);
      //downloadContentClient(message.fileName);
      break;
    case 'error':
      alert(`Error: ${message.message}`);
      break;
  }
};

const fetchUrls = () => {
  const keyword = document.getElementById('keyword').value;
  ws.send(JSON.stringify({ type: 'get_urls', keyword }));
};

const downloadContentServer = (url) => {
  ws.send(JSON.stringify({ type: 'download', url }));
};

const downloadContentClient = (filename) => {
  window.location.href = `${serverURL}/${filename}`;
};

document.getElementById('fetchUrls').addEventListener('click', fetchUrls);

const { workerData, parentPort } = require('worker_threads');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { Throttle } = require('stream-throttle');

const { url, filePath, threadId, speedLimit } = workerData;

const downloadFile = async (url, filePath, threadId, speedLimit) => {
  const response = await axios({
    method: 'get',
    url: url,
    responseType: 'stream'
  });

  const contentLength = response.headers.get('content-length');
  const writer = fs.createWriteStream(filePath);
  const throttle = new Throttle({ rate: speedLimit });
  let downloadedLength = 0;
  let fileName = filePath.split(path.sep).pop();

  response.data.pipe(throttle).on('data', (chunk) => {
    downloadedLength += chunk.length;
    const progress = (downloadedLength / contentLength) * 100;
    parentPort.postMessage({ type: 'progress', progress, downloadedLength, contentLength, threadId, fileName});
  }).pipe(writer);

  writer.on('finish', () => {
    parentPort.postMessage({ type: 'complete', fileName });
  });

  writer.on('error', () => {
    parentPort.postMessage({ type: 'error', message: 'File write error' });
  });
};

downloadFile(url, filePath, threadId, speedLimit);
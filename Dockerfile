FROM node:22.3.0

WORKDIR /app

COPY package.json ./
COPY server.js ./
COPY worker.js ./
COPY .env ./

RUN npm install

CMD ["node","server.js" ]
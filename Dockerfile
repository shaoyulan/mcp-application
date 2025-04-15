FROM node:23.11.0-alpine

WORKDIR /app

COPY . .

RUN npm install

RUN npm run build

CMD ["node", "./build/client.js ./build/server.js"]
FROM node:22-alpine
RUN mkdir -p /mnt/dados/projects/biblia_backend/node_modules && chown -R node:node /mnt/dados/projects/biblia_backend
WORKDIR /mnt/dados/projects/biblia_backend
COPY package*.json ./
USER node
RUN npm install
COPY --chown=node:node . .
RUN npm install typescript

ENV HOSTNAME=http://localhost
ENV HTTP_PORT=3333

EXPOSE 3333

CMD [ "npx","ts-node", "./src/swagger.ts" ]

FROM node:current-alpine
RUN mkdir -p /mnt/dados/projects/biblia_backend/node_modules && chown -R node:node /mnt/dados/projects/biblia_backend
WORKDIR /mnt/dados/projects/biblia_backend
COPY package*.json ./
USER node
COPY --chown=node:node . .
RUN npm install \
    && npm test

ENV HOSTNAME=http://localhost
ENV HTTP_PORT=3333

EXPOSE 3333

CMD [ "npx", "tsx", "./src/swagger.ts" ]

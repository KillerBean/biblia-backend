FROM node:16-alpine
RUN mkdir -p /mnt/dados/projects/biblia_backend/node_modules && chown -R node:node /mnt/dados/projects/biblia_backend
WORKDIR /mnt/dados/projects/biblia_backend
COPY package*.json ./
USER node
RUN npm install
RUN npm install typescript
COPY --chown=node:node . .

ENV HOSTNAME=http://localhost
ENV HTTP_PORT=3333

EXPOSE 3333

#RUN npm run build

#CMD [ "node", "./src/swagger.js"]
CMD [ "npx","ts-node", "./src/swagger.ts" ]

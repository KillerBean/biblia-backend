#!/bin/bash
set -e

cd /opt/projects/production

echo "Pulling latest images..."
docker compose pull biblia-app-01 biblia-app-02

echo "Restarting services..."
docker compose up -d --no-deps biblia-app-01 biblia-app-02

docker exec nginx nginx -s reload 2>/dev/null || true
docker image prune -f || true

echo "Deploy concluído."

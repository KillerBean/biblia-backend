#!/bin/bash
set -e

cd /opt/projects/production

echo "Pulling latest images..."
docker compose pull biblia-app

echo "Restarting services..."
docker compose up -d --no-deps biblia-app

docker exec nginx nginx -s reload 2>/dev/null || true
docker image prune -f || true

echo "Deploy concluído."

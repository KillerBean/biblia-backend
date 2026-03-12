#!/bin/bash
set -e

cd /opt/projects/biblia-backend

echo "Pulling latest image..."
docker compose pull app-01 app-02

echo "Restarting services..."
docker compose up -d

echo "Deploy concluído."

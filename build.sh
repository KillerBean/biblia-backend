#!/bin/env sh

docker compose down --rmi local
docker compose up --build -d --force-recreate

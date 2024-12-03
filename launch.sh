#!/bin/env sh

while i in "$@"; do
    case $i in
        -d|--down)
            docker compose down --rmi local
            shift
            ;;
        -u|--up)
            docker compose up --build -d --force-recreate
            shift
            ;;
        -a|--all)
            docker compose down --rmi local
            docker compose up --build -d --force-recreate
            shift
            ;;
        *)
            echo "Unknown option: $i"
            exit 1
            ;;
    esac
done


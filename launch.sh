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
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -d, --down    Stop and remove containers"
            echo "  -u, --up      Build and start containers"
            echo "  -a, --all     Stop and remove containers, then build and start containers"
            echo "  -h, --help    Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $i"
            echo "Use -h or --help for help"
            exit 1
            ;;
    esac
done


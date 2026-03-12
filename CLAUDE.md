# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bible Backend API - A REST API serving Bible text in Portuguese with multiple translations. Built with Express.js and TypeScript (ESM modules), using SQLite databases for Bible content and Redis for caching.

## Common Commands

```bash
npm run dev          # Development server with hot reload
npm test             # Run Jest tests
npm run swagger      # Regenerate Swagger documentation
npm start            # Production start (no hot reload)
```

**Docker deployment:**
```bash
./launch.sh -a       # Full deploy (down + up)
./launch.sh -u       # Build and start containers
./launch.sh -d       # Stop and remove containers
```

## Architecture

### Request Flow
```
Nginx (load balancer) → Express instances (app-01, app-02) → Redis cache → SQLite
```

### Directory Structure
- `src/controllers/` - Database controllers implementing `IController` interface
- `src/services/` - Redis connection and configuration
- `src/middlewares/` - Cache, IP detection, custom headers
- `src/utils/` - Bible reference parser and book name mappings
- `src/db/sqlite/` - SQLite databases (one per Bible translation: ARC, NVI, NTLH, KJA, KJF, ACF)

### Key Components
- **SqliteController** (`src/controllers/sqlite-controller.ts`): Main database controller, instantiated as singleton and passed to router
- **Cache middleware** (`src/middlewares/cache.ts`): Redis caching wrapper with 1-hour TTL, uses `cache:{originalUrl}` keys
- **Bible parser** (`src/utils/bible-parser.ts`): Parses Portuguese Bible references (e.g., "João 3:16", "Gn 1-3") into structured queries

### Database Schema (SQLite)
Each translation is a separate `.sqlite` file with tables: `book`, `verse`, `testament`, `metadata`. See `src/db/sqlite/schema.sql`.

## Environment Variables

- `HTTP_PORT` - Server port (default: 3333)
- `NODE_ENV` - development/production (affects CORS strictness)
- `REDIS_HOST`, `REDIS_PORT` - Redis connection (default port: 6379)

## API Documentation

Interactive docs available at `/docs` endpoint when server is running.

import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import favicon from 'serve-favicon';
import bodyParser from 'body-parser';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import PathUtils from './utils/path-utils.ts';
import { createApiRouter } from './router.ts';
import { loggerMiddleware } from './middlewares/logger.ts';
import type IController from './controllers/controller-interface.ts';
import type { CacheClient } from './middlewares/cache.ts';
import { createV1Router } from './v1-router.ts';
import { TranslationService } from './services/translation-service.ts';

export interface AppRedisClient extends CacheClient {
    ping(): Promise<unknown>;
}

export function resolveCorsOrigins(
    configuredOrigins: string | undefined,
    nodeEnvironment: string | undefined,
    port: string | number,
): string[] {
    if (!configuredOrigins?.trim()) {
        if (nodeEnvironment === 'production') {
            throw new Error('CORS_ORIGINS is required in production');
        }
        return [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
    }

    const origins = configuredOrigins
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (origins.length === 0) {
        throw new Error('CORS_ORIGINS must contain at least one origin');
    }

    for (const origin of origins) {
        let parsed: URL;
        try {
            parsed = new URL(origin);
        } catch {
            throw new Error(`Invalid CORS origin: ${origin}`);
        }

        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin) {
            throw new Error(`CORS origin must be an absolute HTTP(S) origin: ${origin}`);
        }
    }

    return origins;
}

type SwaggerDocument = Record<string, unknown>;

export function createApp(
    dbController: IController,
    redisClient: AppRedisClient,
    swaggerDocument: SwaggerDocument,
    environment: NodeJS.ProcessEnv = process.env,
): express.Application {
    const port = environment.HTTP_PORT || '3333';
    const allowedOrigins = resolveCorsOrigins(
        environment.CORS_ORIGINS,
        environment.NODE_ENV,
        port,
    );
    const app = express();
    const translationService = new TranslationService(environment.BIBLE_DATA_DIR);

    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    app.use(helmet());
    app.use(rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 100,
        standardHeaders: true,
        legacyHeaders: false,
        skip: (req) => req.path === '/health',
    }));
    app.use(loggerMiddleware);
    app.use(bodyParser.json({ limit: '50kb' }));
    app.use(cors({ origin: allowedOrigins, optionsSuccessStatus: 200 }));

    const searchLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 20,
        standardHeaders: true,
        legacyHeaders: false,
    });
    const document = { ...swaggerDocument, servers: [{ url: '/' }] };
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(document));
    app.use(favicon(path.join(PathUtils.__dirname, '../../images/favicon.ico')));

    app.get('/health', async (_req, res) => {
        const uptime = process.uptime();
        const memoryMB = Math.round(process.memoryUsage().rss / 1024 / 1024);

        try {
            await redisClient.ping();
        } catch {
            return res.status(503).json({ status: 'error', redis: 'disconnected', uptime, memoryMB });
        }

        try {
            await dbController.ping();
        } catch {
            return res.status(503).json({ status: 'error', sqlite: 'inaccessible', uptime, memoryMB });
        }

        if (environment.NODE_ENV === 'production') {
            try {
                await translationService.ping('public');
            } catch {
                return res.status(503).json({
                    status: 'error', translations: 'inaccessible', uptime, memoryMB,
                });
            }
        }

        return res.json({
            status: 'ok', uptime, redis: 'connected', sqlite: 'accessible',
            translations: environment.NODE_ENV === 'production' ? 'accessible' : 'not-checked', memoryMB,
        });
    });

    app.get('/', (_req, res) => res.json({
        project: 'API Bíblica Multilíngue de Consulta',
        commercial: false,
        mission: 'Oferecer leitura e estudo bíblico com fontes e licenças verificáveis.',
        legalNotice: 'Cada tradução possui termos próprios. Consulte /terms e os metadados de direitos de cada resposta.',
        contact: environment.LEGAL_CONTACT_EMAIL ?? null,
        api: '/v1/public',
    }));
    app.get('/terms', (_req, res) => res.json({
        massDownload: 'Permitido somente quando indicado nos metadados da tradução e dentro da licença aplicável.',
        attribution: 'Os créditos retornados pela API devem acompanhar qualquer exibição ou redistribuição.',
        takedown: `Titulares podem solicitar revisão pelo contato ${environment.LEGAL_CONTACT_EMAIL ?? 'não configurado'}.`,
        noWarranty: true,
    }));

    app.use('/v1', createV1Router(environment, translationService));

    // Temporary rollback bridge. Production must opt in explicitly; unreviewed legacy
    // SQLite files are never exposed by the v1 catalog.
    if (environment.NODE_ENV !== 'production' || environment.ENABLE_LEGACY_API === 'true') {
        app.use('/', createApiRouter(dbController, searchLimiter, redisClient));
    }

    app.use((_req, res) => {
        res.status(404).json({ error: 'Not Found' });
    });

    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        if (typeof err === 'object' && err !== null && 'type' in err && err.type === 'entity.too.large') {
            res.status(413).json({ error: 'Request body too large', requestId: res.locals.requestId });
            return;
        }

        if (typeof err === 'object' && err !== null && 'status' in err && typeof err.status === 'number') {
            res.status(err.status).json({ error: err instanceof Error ? err.message : 'Request failed' });
            return;
        }

        console.error(JSON.stringify({
            event: 'error',
            requestId: res.locals.requestId,
            error: err instanceof Error ? err.stack : String(err),
        }));
        res.status(500).json({ error: 'Internal Server Error', requestId: res.locals.requestId });
    });

    return app;
}

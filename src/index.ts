import 'dotenv/config';
import cors from 'cors';
import path from 'node:path';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import favicon from 'serve-favicon';
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express';
import PathUtils  from './utils/path-utils.ts';
import { createApiRouter } from "./router.ts";
import getIPAddress from './middlewares/get-ip.ts';
import { loggerMiddleware } from './middlewares/logger.ts';
import swaggerFile from "./swagger-output.json" with { type: "json" };
import SqliteController from './controllers/sqlite-controller.ts';
import redisClient from './services/redis-service.ts';


// Guard: produção exige REDIS_PASSWORD
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_PASSWORD) {
    console.error('FATAL: REDIS_PASSWORD required in production');
    process.exit(1);
}

const PORT = process.env.HTTP_PORT || 3333
const HOSTNAME = process.env.HOSTNAME || ("http://" + getIPAddress())

// App Express
const app = express()

// Security Middleware
app.use(helmet());

// Rate Limiting
const limiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 100,
	standardHeaders: true,
	legacyHeaders: false,
	skip: (req) => req.path === '/health',
})

const searchLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	limit: 20,
	standardHeaders: true,
	legacyHeaders: false,
})

app.use(limiter)

// Trust Proxy (for Nginx)
app.set('trust proxy', 1);

// Adjust Swagger server URL dynamically to be relative
// @ts-ignore
swaggerFile.servers = [{ url: '/' }];


const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
    : [`${HOSTNAME}:${PORT}`]

const corsOptions = {
    origin: allowedOrigins,
    optionsSuccessStatus: 200
};


/* Middlewares */
// Switch off the default 'X-Powered-By: Express' header
app.disable( 'x-powered-by' );
app.use(loggerMiddleware);
app.use(bodyParser.json({ limit: '50kb' }));

// Cors
app.use(cors(corsOptions))
// Docs swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Cria o controller e o roteador
const dbController = await SqliteController.create();
const apiRouter = createApiRouter(dbController, searchLimiter);

// Health check — excluído do cache, rate limit e logger
app.get('/health', async (req, res) => {
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

    res.json({ status: 'ok', uptime, redis: 'connected', sqlite: 'accessible', memoryMB });
});

// Rotas
app.use('/', apiRouter)

app.use(favicon(path.join(PathUtils.__dirname, '../../images/favicon.ico')));

// Resposta padrão para quaisquer outras requisições:
app.use((req, res) => {
    res.status(404).send('Not Found')
})

// Error handler global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(JSON.stringify({ event: 'error', requestId: res.locals.requestId, error: err.stack }));
    res.status(500).json({ error: 'Internal Server Error', requestId: res.locals.requestId });
})

// Inicia o sevidor
const server = app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso ${HOSTNAME}:${PORT}`)
})

async function gracefulShutdown(signal: string) {
    console.log(JSON.stringify({ event: 'shutdown', signal }));
    const forceExit = setTimeout(() => {
        console.error(JSON.stringify({ event: 'shutdown_timeout', signal }));
        process.exit(1);
    }, 30_000);
    server.close(async () => {
        clearTimeout(forceExit);
        await redisClient.quit();
        process.exit(0);
    });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    console.error(JSON.stringify({ event: 'unhandledRejection', reason: String(reason) }));
});

process.on('uncaughtException', (err: Error) => {
    console.error(JSON.stringify({ event: 'uncaughtException', error: err.message }));
    gracefulShutdown('uncaughtException');
});

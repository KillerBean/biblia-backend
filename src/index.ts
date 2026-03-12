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
import swaggerFile from "./swagger-output.json" with { type: "json" };
import SqliteController from './controllers/sqlite-controller.ts';


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
app.use(bodyParser.json({ limit: '50kb' }));

// Cors
app.use(cors(corsOptions))
// Docs swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Cria o controller e o roteador
const dbController = await SqliteController.create();
const apiRouter = createApiRouter(dbController, searchLimiter);

// Rotas
app.use('/', apiRouter)

app.use(favicon(path.join(PathUtils.__dirname, '../../images/favicon.ico')));

// Resposta padrão para quaisquer outras requisições:
app.use((req, res) => {
    res.status(404).send('Not Found')
})

// Error handler global
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack)
    res.status(500).send('Internal Server Error')
})

// Inicia o sevidor
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso ${HOSTNAME}:${PORT}`)
})

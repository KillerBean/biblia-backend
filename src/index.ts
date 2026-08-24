import 'dotenv/config';
import getIPAddress from './middlewares/get-ip.ts';
import swaggerFile from "./swagger-output.json" with { type: "json" };
import SqliteController from './controllers/sqlite-controller.ts';
import redisClient from './services/redis-service.ts';
import { createApp } from './app.ts';

// Guard: produção exige REDIS_PASSWORD
if (process.env.NODE_ENV === 'production' && !process.env.REDIS_PASSWORD) {
    console.error('FATAL: REDIS_PASSWORD required in production');
    process.exit(1);
}

const port = Number(process.env.HTTP_PORT || 3333);
const hostname = process.env.HOSTNAME || ("http://" + getIPAddress());
const dbController = await SqliteController.create();
const app = createApp(dbController, redisClient, swaggerFile);

const server = app.listen(port, () => {
    console.log(JSON.stringify({ event: 'server_started', hostname, port }));
})

let shuttingDown = false;
async function gracefulShutdown(signal: string): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
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

process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => void gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
    console.error(JSON.stringify({ event: 'unhandledRejection', reason: String(reason) }));
});

process.on('uncaughtException', (err: Error) => {
    console.error(JSON.stringify({ event: 'uncaughtException', error: err.message }));
    void gracefulShutdown('uncaughtException');
});

export { app };

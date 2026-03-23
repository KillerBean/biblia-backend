import { Redis } from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

if (process.env.NODE_ENV !== 'production') {
    console.log(`Conectando ao Redis em ${REDIS_HOST}:${REDIS_PORT}`);
}

const redisClient = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    password: REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
});

redisClient.on('error', (err: { message: any; }) => {
    // Evita crashar a app se o Redis cair, apenas loga
    console.warn('⚠️ Erro na conexão com Redis (Cache desativado temporariamente):', err.message);
});

redisClient.on('connect', () => {
    if (process.env.NODE_ENV !== 'production') {
        console.log('Conectado ao Redis com sucesso!');
    }
});

export default redisClient;

import { createHash } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import redisClient from '../services/redis-service.ts';

// Duração padrão do cache: 1 hora (3600 segundos)
const DEFAULT_CACHE_TTL = 3600;

function buildCacheKey(req: Request): string {
    // Hash SHA-256 da URL em todas as rotas:
    // - Evita cache poisoning via req.originalUrl malformado
    // - Em /search: impede exposição do conteúdo da busca no Redis
    const hash = createHash('sha256').update(req.originalUrl).digest('hex');
    return `cache:${req.path}:${hash}`;
}

export const cacheMiddleware = (duration: number = DEFAULT_CACHE_TTL) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        // Apenas cacheamos requisições GET
        if (req.method !== 'GET') {
            return next();
        }

        const key = buildCacheKey(req);

        try {
            const cachedResponse = await redisClient.get(key);

            if (cachedResponse) {
                // Header indicando que veio do cache
                res.setHeader('X-Cache', 'HIT');
                res.setHeader('Content-Type', 'application/json');
                return res.send(cachedResponse);
            }

            // Se não estiver no cache, interceptamos a resposta para salvar depois
            res.setHeader('X-Cache', 'MISS');
            
            // Armazena a referência original do método send/json
            const originalSend = res.send;

            // Sobrescreve o método send
            res.send = (body: any): Response => {
                // Restaura o método original para evitar loop infinito na próxima chamada
                res.send = originalSend;

                // Salva no Redis (apenas se for status 200)
                if (res.statusCode === 200) {
                    // Se o body for objeto, converte para string
                    const value = typeof body === 'string' ? body : JSON.stringify(body);
                    
                    // Salva assincronamente (sem await para não bloquear a resposta)
                    redisClient.set(key, value, 'EX', duration).catch((err: any) => 
                        console.error('Erro ao salvar no cache:', err)
                    );
                }

                // Envia a resposta original
                return res.send(body);
            };

            next();
        } catch (err) {
            console.error('Erro no middleware de cache:', err);
            next();
        }
    };
};

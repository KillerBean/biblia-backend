import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex');
}

function secureEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

interface ApiConsumer {
    id: string;
    keyHash: string;
    scopes: string[];
}

function loadConsumers(environment: NodeJS.ProcessEnv): ApiConsumer[] {
    const legacy = (environment.PUBLIC_API_KEY_HASHES ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((keyHash, index) => ({ id: `legacy-${index + 1}`, keyHash, scopes: ['bible:read'] }));
    if (!environment.PUBLIC_API_CONSUMERS_JSON?.trim()) return legacy;
    const parsed = JSON.parse(environment.PUBLIC_API_CONSUMERS_JSON) as ApiConsumer[];
    if (!Array.isArray(parsed) || parsed.some((consumer) =>
        !consumer.id || !/^[a-f0-9]{64}$/.test(consumer.keyHash) || !Array.isArray(consumer.scopes)
    )) {
        throw new Error('Invalid PUBLIC_API_CONSUMERS_JSON');
    }
    return [...parsed, ...legacy];
}

export function requirePublicApiKey(
    environment: NodeJS.ProcessEnv = process.env,
    requiredScope = 'bible:read',
): RequestHandler {
    const consumers = loadConsumers(environment);
    return (req, res, next) => {
        if (consumers.length === 0) {
            res.status(503).json({ error: 'Public API access is not configured' });
            return;
        }
        const key = req.header('x-api-key');
        const keyHash = key ? sha256(key) : '';
        const consumer = consumers.find((item) => secureEqual(item.keyHash, keyHash));
        if (!consumer) {
            res.status(401).json({ error: 'A valid API key is required' });
            return;
        }
        if (!consumer.scopes.includes(requiredScope)) {
            res.status(403).json({ error: `API key lacks scope ${requiredScope}` });
            return;
        }
        res.locals.apiConsumer = consumer.id;
        res.locals.apiScopes = consumer.scopes;
        next();
    };
}

export function requireAppServiceToken(environment: NodeJS.ProcessEnv = process.env): RequestHandler {
    const expected = environment.APP_SERVICE_TOKEN ?? '';
    return (req, res, next) => {
        const bearer = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
        if (!expected || !secureEqual(bearer, expected)) {
            res.status(401).json({ error: 'A valid app service token is required' });
            return;
        }
        next();
    };
}

export function apiKeyFingerprint(value: string | undefined): string {
    return value ? sha256(value).slice(0, 16) : 'anonymous';
}

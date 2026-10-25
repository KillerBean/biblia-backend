import { createHash } from 'node:crypto';
import express from 'express';
import request from 'supertest';
import { requireAppServiceToken, requirePublicApiKey } from './api-auth.ts';

describe('API authentication', () => {
    it('accepts a public key while storing only its SHA-256', async () => {
        const key = 'bbl_test-secret';
        const app = express().use(
            requirePublicApiKey({ PUBLIC_API_KEY_HASHES: createHash('sha256').update(key).digest('hex') }),
            (_req, res) => res.json({ ok: true }),
        );
        expect((await request(app).get('/').set('X-API-Key', key)).status).toBe(200);
        expect((await request(app).get('/').set('X-API-Key', 'wrong')).status).toBe(401);
    });

    it('keeps the app token in a separate Bearer channel', async () => {
        const app = express().use(
            requireAppServiceToken({ APP_SERVICE_TOKEN: 'service-secret' }),
            (_req, res) => res.json({ ok: true }),
        );
        expect((await request(app).get('/').set('Authorization', 'Bearer service-secret')).status).toBe(200);
        expect((await request(app).get('/').set('X-API-Key', 'service-secret')).status).toBe(401);
    });

    it('enforces scopes from the structured consumer registry', async () => {
        const key = 'bbl_search-only';
        const app = express().use(
            requirePublicApiKey({
                PUBLIC_API_CONSUMERS_JSON: JSON.stringify([{
                    id: 'search-client',
                    keyHash: createHash('sha256').update(key).digest('hex'),
                    scopes: ['bible:search'],
                }]),
            }, 'bible:read'),
            (_req, res) => res.json({ ok: true }),
        );
        expect((await request(app).get('/').set('X-API-Key', key)).status).toBe(403);
    });
});

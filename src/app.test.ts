import request from 'supertest';
import { jest } from '@jest/globals';
import MockSqliteController from './__mocks__/sqlite-controller.ts';
import { createApp, resolveCorsOrigins, type AppRedisClient } from './app.ts';

function createRedisMock(): AppRedisClient {
    return {
        get: jest.fn<() => Promise<string | null>>().mockResolvedValue(null),
        set: jest.fn<() => Promise<string>>().mockResolvedValue('OK'),
        ping: jest.fn<() => Promise<string>>().mockResolvedValue('PONG'),
    } as unknown as AppRedisClient;
}

describe('HTTP application contract', () => {
    it('rejects implicit production CORS configuration', () => {
        expect(() => resolveCorsOrigins(undefined, 'production', 3333))
            .toThrow('CORS_ORIGINS is required in production');
    });

    it('accepts only explicit HTTP(S) origins', () => {
        expect(resolveCorsOrigins('https://biblia.example, http://localhost:3333', 'production', 3333))
            .toEqual(['https://biblia.example', 'http://localhost:3333']);
        expect(() => resolveCorsOrigins('https://biblia.example/path', 'production', 3333))
            .toThrow('absolute HTTP(S) origin');
    });

    it('exposes health, security and correlation headers', async () => {
        const redis = createRedisMock();
        const controller = await MockSqliteController.create();
        const app = createApp(controller, redis, {}, {
            NODE_ENV: 'test',
            HTTP_PORT: '3333',
            CORS_ORIGINS: 'https://biblia.example',
        });

        const response = await request(app)
            .get('/health')
            .set('Origin', 'https://biblia.example');

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ status: 'ok', redis: 'connected', sqlite: 'accessible' });
        expect(response.headers['x-request-id']).toBeDefined();
        expect(response.headers['x-content-type-options']).toBe('nosniff');
        expect(response.headers['access-control-allow-origin']).toBe('https://biblia.example');
    });

    it('returns a structured 503 when Redis is unavailable', async () => {
        const redis = createRedisMock();
        jest.mocked(redis.ping).mockRejectedValueOnce(new Error('offline'));
        const controller = await MockSqliteController.create();
        const app = createApp(controller, redis, {}, {
            NODE_ENV: 'test',
            CORS_ORIGINS: 'https://biblia.example',
        });

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body).toMatchObject({ status: 'error', redis: 'disconnected' });
    });

    it('returns JSON for unknown routes', async () => {
        const app = createApp(await MockSqliteController.create(), createRedisMock(), {});
        const response = await request(app).get('/does-not-exist');

        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Not Found' });
    });

    it('converts asynchronous controller failures into a safe 500 response', async () => {
        const controller = await MockSqliteController.create();
        jest.mocked(controller.getBooks).mockRejectedValueOnce(new Error('database failure'));
        const app = createApp(controller, createRedisMock(), {});

        const response = await request(app).get('/books');

        expect(response.status).toBe(500);
        expect(response.body.error).toBe('Internal Server Error');
        expect(response.body.requestId).toBe(response.headers['x-request-id']);
        expect(response.text).not.toContain('database failure');
    });
});

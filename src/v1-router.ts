import express, { type RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { apiKeyFingerprint, requireAppServiceToken, requirePublicApiKey } from './middlewares/api-auth.ts';
import { TranslationService, type TranslationAudience } from './services/translation-service.ts';

type AsyncHandler = (req: express.Request, res: express.Response) => Promise<void>;
const asyncHandler = (handler: AsyncHandler): RequestHandler => (req, res, next) => {
    void handler(req, res).catch(next);
};

function integer(value: string, min: number, max: number): number | undefined {
    if (!/^\d+$/.test(value)) return undefined;
    const parsed = Number(value);
    return parsed >= min && parsed <= max ? parsed : undefined;
}

function parameter(value: string | string[]): string {
    return Array.isArray(value) ? value[0] : value;
}

function rights(translation: Awaited<ReturnType<TranslationService['definition']>>) {
    if (!translation) return undefined;
    return {
        translationId: translation.id,
        credit: translation.license.credit,
        license: translation.license.spdx,
        noticeUrl: translation.license.noticeUrl,
        officialUrl: translation.license.officialUrl,
        massReproductionAllowed: translation.license.allowOfflineDistribution,
    };
}

function audienceRouter(service: TranslationService, audience: TranslationAudience): express.Router {
    const router = express.Router();
    router.get('/translations', asyncHandler(async (_req, res) => {
        const translations = await service.list(audience);
        res.json({ data: translations.map((item) => ({
            id: item.id,
            abbreviation: item.abbreviation,
            name: item.name,
            language: item.language,
            direction: item.direction,
            rights: rights(item),
        })) });
    }));
    router.get('/translations/:translationId/license', asyncHandler(async (req, res) => {
        const translationId = parameter(req.params.translationId);
        const translation = await service.definition(translationId, audience);
        if (!translation) { res.status(404).json({ error: 'Translation not found' }); return; }
        res.json({ data: rights(translation) });
    }));
    router.get('/translations/:translationId/books', asyncHandler(async (req, res) => {
        const translationId = parameter(req.params.translationId);
        const translation = await service.definition(translationId, audience);
        const data = await service.books(translationId, audience);
        res.json({ data, rights: rights(translation) });
    }));
    router.get('/translations/:translationId/books/:bookId/chapters/:chapter', asyncHandler(async (req, res) => {
        const translationId = parameter(req.params.translationId);
        const bookId = parameter(req.params.bookId);
        const chapter = integer(parameter(req.params.chapter), 1, 150);
        if (!chapter || !/^[1-3A-Z]{3}$/.test(bookId.toUpperCase())) {
            res.status(400).json({ error: 'Invalid book or chapter' }); return;
        }
        const translation = await service.definition(translationId, audience);
        const data = await service.chapter(translationId, bookId, chapter, audience);
        res.json({ data, rights: rights(translation) });
    }));
    router.get('/translations/:translationId/search', asyncHandler(async (req, res) => {
        const translationId = parameter(req.params.translationId);
        const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
        const limit = typeof req.query.limit === 'string' ? integer(req.query.limit, 1, 50) : 20;
        if (query.length < 2 || query.length > 100 || !limit) {
            res.status(400).json({ error: 'Search must have 2-100 characters and limit must be 1-50' }); return;
        }
        const translation = await service.definition(translationId, audience);
        const data = await service.search(translationId, query, limit, audience);
        res.json({ data, rights: rights(translation) });
    }));
    return router;
}

export function createV1Router(
    environment: NodeJS.ProcessEnv = process.env,
    service = new TranslationService(environment.BIBLE_DATA_DIR),
): express.Router {
    const router = express.Router();
    const publicLimiter = rateLimit({
        windowMs: 60_000,
        limit: Number(environment.PUBLIC_API_RATE_LIMIT ?? 60),
        keyGenerator: (req) => apiKeyFingerprint(req.header('x-api-key')),
        standardHeaders: true,
        legacyHeaders: false,
    });
    router.use('/public', publicLimiter, requirePublicApiKey(environment), audienceRouter(service, 'public'));
    router.use('/app', requireAppServiceToken(environment), audienceRouter(service, 'app'));
    return router;
}

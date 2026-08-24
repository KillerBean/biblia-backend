import express, { RequestHandler } from 'express'
import IController from './controllers/controller-interface.ts'
import { cacheMiddleware, CacheClient } from './middlewares/cache.ts'

function parseBoundedInteger(value: unknown, maximum: number): number | null {
    if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

type AsyncHandler = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
) => Promise<unknown>;

const asyncHandler = (handler: AsyncHandler): RequestHandler => (req, res, next) => {
    void handler(req, res, next).catch(next);
};

export const createApiRouter = (
    dbController: IController,
    searchLimiter: RequestHandler,
    redisClient?: CacheClient,
) => {
    const apiRouter = express.Router()

    // Cache de 1 hora para rotas gerais
    apiRouter.use(cacheMiddleware(3600, redisClient));

    apiRouter.get('/', (req, res, next) => {
        res.send(dbController?.index())
    })

    apiRouter.get('/books', asyncHandler(async (req, res) => {
        // #swagger.parameters['name'] = { in: 'query', type: 'string' }
        const name = req.query.name;
        if (name !== undefined && typeof name !== 'string') {
            res.status(400).send('Query parameter "name" must be a string');
            return;
        }
        if (name && name.length > 100) {
            res.status(400).send('Query parameter "name" too long (max 100 characters)');
            return;
        }
        const books = await dbController.getBooks(name)
        res.send(books)
    }))

    apiRouter.get('/books/:bookId', asyncHandler(async (req, res) => {
        //  #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
        const bookId = parseBoundedInteger(req.params.bookId, 66);
        if(bookId === null){
            res.status(400).send('Invalid book ID')
            return
        }
        
        const result = await dbController.getBookByID(bookId)
        if (!result) {
            res.status(404).send('Book not found');
            return;
        }
        res.json(result)
    }))

    apiRouter.get('/books/:bookId/chapters', asyncHandler(async (req, res) => {
        // #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
        const bookId = parseBoundedInteger(req.params.bookId, 66);
        if(bookId === null){
            res.status(400).send('Invalid book ID')
            return
        }
        
        const result = await dbController.getChapterCount(bookId)
        // If result is empty, it might mean book doesn't exist or has no chapters.
        // Assuming book exists check is implicitly done by empty result.
        if (!result || result.length === 0) {
             res.status(404).send('Book not found or has no chapters')
             return
        }
        res.json(result)
    }))

    apiRouter.get('/books/testament/:testamentId', asyncHandler(async (req, res) => {
        //  #swagger.parameters['testamentId'] = { in: 'path', type: 'number' }
        const testamentId = parseBoundedInteger(req.params.testamentId, 2);
        if(testamentId === null){
            res.status(400).send('Invalid testament ID')
            return
        }
        
        const result = await dbController.getBooksByTestament(testamentId)
        res.json(result)
    }))

    apiRouter.get('/verses/:bookId', asyncHandler(async (req, res) => {
        //  #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
        const bookId = parseBoundedInteger(req.params.bookId, 66);
        if(bookId === null){
            res.status(400).send('Invalid book ID')
            return
        }
        
        const result = await dbController.getVerses(bookId)
        res.json(result)
    }))

    apiRouter.get('/verses/:bookId/:chapterId', asyncHandler(async (req, res) => {
        /**
         *  #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
         *  #swagger.parameters['chapterId'] = { in: 'path', type: 'number' }
         *  #swagger.parameters['start'] = { in: 'query', type: 'number' }
         *  #swagger.parameters['end'] = { in: 'query', type: 'number' }
         * */
        const bookId = parseBoundedInteger(req.params.bookId, 66);
        const chapterId = parseBoundedInteger(req.params.chapterId, 150);
        const start = req.query.start === undefined
            ? undefined
            : parseBoundedInteger(req.query.start, 176);
        const end = req.query.end === undefined
            ? undefined
            : parseBoundedInteger(req.query.end, 176);

        if(bookId === null || chapterId === null){
            res.status(400).send('Invalid book ID or chapter')
            return
        }
        if (req.query.start !== undefined && start === null) {
            res.status(400).send('Invalid start verse')
            return
        }
        if (req.query.end !== undefined && end === null) {
            res.status(400).send('Invalid end verse')
            return
        }
        const startVerse = start ?? undefined;
        const endVerse = end ?? undefined;
        if (startVerse !== undefined && endVerse !== undefined && startVerse > endVerse) {
            res.status(400).send('Start verse must be less than or equal to end verse')
            return
        }
        
        const result = await dbController.getVerses(bookId, chapterId, startVerse, endVerse)
        res.json(result)
    }))

    apiRouter.get('/versions', asyncHandler(async (_req, res) => {
        const versions = await dbController.getVersionList()
        res.send(versions)
    }))

    apiRouter.get('/search', searchLimiter, asyncHandler(async (req, res) => {
        // #swagger.parameters['query'] = { in: 'query', type: 'string' }
        const query = req.query.query;
        if (typeof query !== 'string' || !query) {
            res.status(400).send('Missing query parameter "query"');
            return;
        }
        if (query.length > 200) {
            res.status(400).send('Query too long (max 200 characters)');
            return;
        }
        const result = await dbController.search(query);
        res.json(result);
    }))

    return apiRouter
}

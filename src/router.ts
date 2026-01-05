import express from 'express'
import IController from './controllers/controller-interface.ts'
import { cacheMiddleware } from './middlewares/cache.ts'

export const createApiRouter = (dbController: IController) => {
    const apiRouter = express.Router()

    // Cache de 1 hora para rotas gerais
    apiRouter.use(cacheMiddleware(3600));

    apiRouter.get('/', (req, res, next) => {
        res.send(dbController?.index())
    })

    apiRouter.get('/books', async (req, res, next) => {
        // #swagger.parameters['name'] = { in: 'query', type: 'string' }
        const name = req.query.name as string;
        const books = await dbController.getBooks(name)
        res.send(books)
    })

    apiRouter.get('/books/:bookId', async (req, res, next) => {
        //  #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
        let bookId = Number.parseInt(req.params.bookId)
        if(Number.isNaN(bookId)){
            res.status(400).send('Invalid book ID')
            return
        }
        
        let result = await dbController.getBookByID(bookId)
        if (!result) {
            res.status(404).send('Book not found');
            return;
        }
        res.json(result)
    })

    apiRouter.get('/books/:bookId/chapters', async (req, res, next) => {
        // #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
        let bookId = Number.parseInt(req.params.bookId)
        if(Number.isNaN(bookId)){
            res.status(400).send('Invalid book ID')
            return
        }
        
        let result = await dbController.getChapterCount(bookId)
        // If result is empty, it might mean book doesn't exist or has no chapters.
        // Assuming book exists check is implicitly done by empty result.
        if (!result || result.length === 0) {
             res.status(404).send('Book not found or has no chapters')
             return
        }
        res.json(result)
    })

    apiRouter.get('/books/testament/:testamentId', async (req, res, next) => {
        //  #swagger.parameters['testamentId'] = { in: 'path', type: 'number' }
        let testamentId = Number.parseInt(req.params.testamentId)
        if(Number.isNaN(testamentId)){
            res.status(400).send('Invalid testament ID')
            return
        }
        
        let result = await dbController.getBooksByTestament(testamentId)
        res.json(result)
    })

    apiRouter.get('/verses/:bookId', async (req, res, next) => {
        //  #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
        let bookId = Number.parseInt(req.params.bookId)
        if(Number.isNaN(bookId)){
            res.status(400).send('Invalid book ID')
            return
        }
        
        let result = await dbController.getVerses(bookId)
        res.json(result)
    })

    apiRouter.get('/verses/:bookId/:chapterId', async (req, res, next) => {
        /**
         *  #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
         *  #swagger.parameters['chapterId'] = { in: 'path', type: 'number' }
         *  #swagger.parameters['start'] = { in: 'query', type: 'number' }
         *  #swagger.parameters['end'] = { in: 'query', type: 'number' }
         * */
        let bookId = Number.parseInt(req.params.bookId)
        let chapterId = Number.parseInt(req.params.chapterId)
        let start = req.query.start ? Number.parseInt(req.query.start as string) : undefined
        let end = req.query.end ? Number.parseInt(req.query.end as string) : undefined
        
        if(Number.isNaN(bookId) || Number.isNaN(chapterId)){
            res.status(400).send('Invalid book ID or chapter')
            return
        }
        
        let result = await dbController.getVerses(bookId, chapterId, start, end)
        res.json(result)
    })

    apiRouter.get('/versions', async (req, res, next) => {
        const versions = await dbController.getVersionList()
        res.send(versions)
    })

    apiRouter.get('/search', async (req, res, next) => {
        // #swagger.parameters['query'] = { in: 'query', type: 'string' }
        const query = req.query.query as string;
        if (!query) {
            res.status(400).send('Missing query parameter "query"');
            return;
        }
        const result = await dbController.search(query);
        res.json(result);
    })

    return apiRouter
}

import express from 'express'
import SqliteController from './controllers/sqlite-controller'
const apiRouter = express.Router()
let dbController: SqliteController;

SqliteController.create().then(controller => {
    dbController = controller;
});

apiRouter.get('/', (req, res, next) => {
    res.send(dbController?.index())
})

apiRouter.get('/books', async (req, res, next) => {
    const books = await dbController.getBooks()
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

apiRouter.get('/verses/:bookId/:chapter', async (req, res, next) => {
    //  #swagger.parameters['bookId'] = { in: 'path', type: 'number' }
    //  #swagger.parameters['chapter'] = { in: 'path', type: 'number' }
    let bookId = Number.parseInt(req.params.bookId)
    let chapter = Number.parseInt(req.params.chapter)
    
    if(Number.isNaN(bookId) || Number.isNaN(chapter)){
        res.status(400).send('Invalid book ID or chapter')
        return
    }
    
    let result = await dbController.getVerses(bookId, chapter)
    res.json(result)
})

apiRouter.get('/versions', async (req, res, next) => {
    const versions = await dbController.getVersionList()
    res.send(versions)
})

export default apiRouter
import express from 'express'
import SourceController from './controllers/source-controller'
const apiRouter = express.Router()

apiRouter.get('/', (req, res, next) => {
    res.send(SourceController.index())
})

apiRouter.get('/books', async (req, res, next) => {
    const books = await SourceController.getBooks()
    res.send(books)
})

apiRouter.get('/books/:bookId', async (req, res, next) => {
    //  #swagger.parameters['bookId'] = { in: 'path', required: false, type: 'number' }
    let bookId = Number.parseInt(req.params.bookId)
    if(isNaN(bookId)){
        res.status(400).send('Invalid book ID')
        return
    }
    
    let result = await SourceController.getBookByID(bookId)
    res.json(result)
})

apiRouter.get('/books/testament/:testamentId', async (req, res, next) => {
    //  #swagger.parameters['testamentId'] = { in: 'path', required: false, type: 'number' }
    let testamentId = Number.parseInt(req.params.testamentId)
    if(isNaN(testamentId)){
        res.status(400).send('Invalid testament ID')
        return
    }
    
    let result = await SourceController.getBooksByTestament(testamentId)
    res.json(result)
})

apiRouter.get('/versions', async (req, res, next) => {
    const versions = await SourceController.getVersionList()
    res.send(versions)
})

export default apiRouter
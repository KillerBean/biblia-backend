import express from 'express'
import SourceController from './controllers/source-controller'
const apiRouter = express.Router()

apiRouter.get('/', (req, res, next) => {
    res.send(SourceController.index())
})

apiRouter.get('/books/:bookId', async (req, res, next) => {
    //  #swagger.parameters['bookId'] = { in: 'path', required: false, type: 'number' }
    let bookId = Number.parseInt(req.params.bookId)
    
    let result = await SourceController.getBookByID(bookId)
    res.json(result)
})

apiRouter.get('/books/testament/:testamentId', async (req, res, next) => {
    //  #swagger.parameters['testamentId'] = { in: 'path', required: false, type: 'number' }

    let testamentId: number = Number.parseInt(req.params.testamentId)
    
    let result = await SourceController.getBooks(testamentId)
    console.log(result)
    res.json(result)
})

apiRouter.get('/versions', async (req, res, next) => {
    const versions = await SourceController.getVersionList()
    res.send(versions)
})

export default apiRouter
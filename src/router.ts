import express from 'express'
import SourceController from './controllers/source-controller'
const apiRouter = express.Router()

apiRouter.get('/', (req, res, next) => {
    res.send(SourceController.index())
})

apiRouter.get('/books/:testamentId?', async (req, res, next) => {
    let testamentId: number | undefined
    if(req.params.testamentId){
        testamentId = Number.parseInt(req.params.testamentId)
    }
    let result = await SourceController.getBooks(testamentId)
    console.log(result)
    res.json(result)
})

apiRouter.get('/versions', async (req, res, next) => {
    const versions = await SourceController.getVersionList()
    res.send(versions)
})

export default apiRouter
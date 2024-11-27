import express from 'express'
import SourceController from './controllers/source-controller'
const apiRouter = express.Router()

apiRouter.get('/', (req, res, next) => {
    res.send(SourceController.index())
})

apiRouter.get('/versions', async (req, res, next) => {
    const versions = await SourceController.getVersionList()
    res.send(versions)
})

export default apiRouter
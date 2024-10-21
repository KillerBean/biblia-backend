import express from 'express'
import SourceController from './controllers/source-controller'
const apiRouter = express.Router()

apiRouter.get('/', (req, res, next) => {
    res.send(SourceController.index())
})

apiRouter.get('/versions', (req, res, next) => {
    res.send(SourceController.getVersionList())
})

export default apiRouter
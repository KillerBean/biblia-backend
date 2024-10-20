import express from 'express'
const apiRouter = express.Router()

apiRouter.get('/', (req, res) => {
    res.send('Lê todos os itens')
})

export default apiRouter
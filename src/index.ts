import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser';
import swaggerUi from 'swagger-ui-express'
import { configDotenv } from 'dotenv';

import apiRouter from "./router";
import swaggerFile from "./swagger-output.json"

// carrega o arquivo .env
configDotenv()

const PORT = process.env.PORT || 4000
const HOSTNAME = process.env.HOSTNAME || 'http://localhost'

// App Express
const app = express()

/* Middlewares */
app.use(bodyParser.json());
// Cors
app.use(cors({
    origin: ['http://localhost:4000']
}))
// Docs swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Rotas
app.use('/api', apiRouter)
app.get('/', (req, res) => {
    res.send('Bem-vindo!')
})


// Resposta padrão para quaisquer outras requisições:
app.use((req, res) => {
    res.status(404)
})

// Inicia o sevidor
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso ${HOSTNAME}:${PORT}`)
})
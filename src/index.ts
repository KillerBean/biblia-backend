import cors from 'cors';
import express from 'express';
import favicon from 'serve-favicon';
import bodyParser from 'body-parser';
import { configDotenv } from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import apiRouter from "./router";
import getIPAddress from './middlewares/get-ip';
import swaggerFile from "./swagger-output.json";

// carrega o arquivo .env
configDotenv()

const PORT = process.env.HTTP_PORT || 4000
const HOSTNAME = "http://" + getIPAddress()

// App Express
const app = express()
const corsOptions = {
    origin: [`${HOSTNAME}:${PORT}`],
    optionsSuccessStatus: 200
};

if (process.env.NODE_ENV === 'development') {
    let localAddresses = [`http://localhost:${PORT}`, 'http://localhost'];
    for (let item of localAddresses){
        corsOptions.origin.push(item);
    }
}



/* Middlewares */
// Switch off the default 'X-Powered-By: Express' header
app.disable( 'x-powered-by' );
app.use(bodyParser.json());

// Cors
app.use(cors(corsOptions))
// Docs swagger
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerFile));

// Rotas
app.use('/', apiRouter)

app.use(favicon(__dirname + '/../images/favicon.ico')); 

// Resposta padrão para quaisquer outras requisições:
app.use((req, res) => {
    res.status(404)
})

// Inicia o sevidor
app.listen(PORT, () => {
    console.log(`Servidor rodando com sucesso ${HOSTNAME}:${PORT}`)
})
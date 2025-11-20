import swaggerAutogen from 'swagger-autogen';

import 'dotenv/config';
import getIPAddress from './middlewares/get-ip.ts';

const PORT = process.env.HTTP_PORT || 4000
const HOSTNAME = "http://" + getIPAddress()//process.env.HOSTNAME || 'http://localhost'


const swaggerOptions = {
  openapi: '3.0.0',
};

const doc = {
    info: {
        version: "1.0.0",
        title: "Api Biblias",
        description: "Essa API traz várias versões da Biblia Sagrada."
    },
    servers: [
        {
            url: `${HOSTNAME}:${PORT}`
        }
    ],
    components: {
        /*schemas: {
            someBody: {
                $name: "Jhon Doe",
                $age: 29,
                about: ""
            },
            someResponse: {
                name: "Jhon Doe",
                age: 29,
                diplomas: [
                    {
                        school: "XYZ University",
                        year: 2020,
                        completed: true,
                        internship: {
                            hours: 290,
                            location: "XYZ Company"
                        }
                    }
                ]
            },
            someEnum: {
                '@enum': [
                    "red",
                    "yellow",
                    "green"
                ]
            }
        },*/
        securitySchemes:{
            bearerAuth: {
                type: 'http',
                scheme: 'bearer'
            }
        }
    }
};

const outputFile = './swagger-output.json';
const endpointsFiles = ['./index', './router'];

async function generateSwaggerDocs() {
    try {
        await swaggerAutogen(swaggerOptions)(outputFile, endpointsFiles, doc);
        await import('./index.ts'); // Your project's root file
    } catch (err) {
        console.error('Error generating swagger:', err);
        process.exit(1);
    }
}

await generateSwaggerDocs();
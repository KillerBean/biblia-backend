const swaggerAutogen = require('swagger-autogen')({ openapi: '3.0.0' });
import { configDotenv } from 'dotenv';

configDotenv()

const PORT = process.env.PORT || 4000
const HOSTNAME = process.env.HOSTNAME || 'http://localhost'

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
const endpointsFiles = ['./index'];

swaggerAutogen(outputFile, endpointsFiles, doc).then(async () => {
    await import('./index'); // Your project's root file
  });
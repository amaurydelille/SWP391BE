const swaggerAutogen = require('swagger-autogen')();

const doc = {
    info: {
        title: 'Arthub',
        description: 'Arthub APIs documentation.'
    },
    host: 'localhost:5000'
};

const outputFile = 'swagger-output.json';
const routes = ['./server/server.js'];

swaggerAutogen(outputFile, routes, doc).then(() => {
    require('./server/server.js');
});
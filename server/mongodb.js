const { MongoClient } = require('mongodb');

const url = 'mongodb://localhost:27017/';
const options = {
    useNewUrlParser: true,
    useUnifiedTopology: true
};

const client = new MongoClient(url, options);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connexion succeded');
        return client.db("arthub");
    } catch (error) {
        console.error('Error when connecting:', error);
        throw error;
    }
}

module.exports = { connectToDatabase };
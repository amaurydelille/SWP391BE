/*const { MongoClient } = require('mongodb');

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

module.exports = { connectToDatabase };*/


const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = "mongodb+srv://root:e0fKr1TjvlO42z1Q@arthub.su4jp8a.mongodb.net/?retryWrites=true&w=majority&appName=arthub";

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB successfully');
        return client.db("arthub");
    } catch (error) {
        console.error('Error when connecting to MongoDB:', error);
        throw error;
    }
}

module.exports = { connectToDatabase };


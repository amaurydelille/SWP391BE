const express = require('express');
const bodyParser = require('body-parser');
const { connectToDatabase } = require('./mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
const port = 5000;
const cors = require('cors');

const generateSecret = () => {
    return crypto.randomBytes(32).toString('hex');
};

const secret_token = generateSecret();
process.env.ACCESS_TOKEN_SECRET = secret_token;

app.use(bodyParser.json());
const corsOptions = {
    origin: 'http://localhost:5173',
    credentials: true,
};

app.use(cors(corsOptions));

app.use(session({
    secret: process.env.ACCESS_TOKEN_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 3600000
    }
}));

app.get('/', (req, res) => {
    res.send('Backend server');
});

let userResults;
let artworkResults;

app.get('/api/getusers', async (req, res) => {
    try {
        const db = await connectToDatabase();
        userResults = await db.collection('users').find({}).limit(50).toArray();
        res.send(userResults).status(200);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error server");
    }
});

app.get('/api/getartwork', async(req, res) => {
   try {
       const db = await connectToDatabase();
       artworkResults = await db.collection('artworks').find({}).limit(50).toArray();
       res.send(artworkResults).status(200);
   } catch (error) {
       console.error('Error:', error);
       res.status(500).send("Error server");
   }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

app.post('/api/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        const hashedPassword = await bcrypt.hash(password, 10);

        const db = await connectToDatabase();
        await db.collection('users').insertOne({ name, email, password: hashedPassword });

        res.status(200).send("User registered successfully");
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error registering user");
    }
});

app.post('/api/addartwork', async (req, res) => {
    try {
        const { title, description, typeDesign, image, name, email, birthday, gender } = req.body;
        const db = await connectToDatabase(); // Await the connection
        const artwork = { title, description, typeDesign, image, name, email, birthday, gender };
        const result = await db.collection('artworks').insertOne(artwork);
        const insertedArtwork = await db.collection('artworks').findOne({ _id: result.insertedId }); // Get the inserted artwork
        res.status(200).json(insertedArtwork); // Send the inserted artwork back to the frontend
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error registering artwork");
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const db = await connectToDatabase();
        const user = await db.collection('users').findOne({ email: email });

        if (!user) {
            return res.status(401).json({ message: 'Email or password is incorrect' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            console.log(JSON.stringify(user._id));
            //req.session.user = user;

            return res.status(200).json({ message: 'Login successful', user: user });
        } else {
            return res.status(401).json({ message: 'Email or password is incorrect' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = {app, userResults, artworkResults};

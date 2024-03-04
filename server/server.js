const express = require('express');
const bodyParser = require('body-parser');
const { connectToDatabase } = require('./mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');

const app = express();
const port = 5000;
const cors = require('cors');

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger-output.json')

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

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
        maxAge: 3600
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

app.get('/api/users/:userId/artworks', async (req, res) => {
    const userId = req.params.userId;
    try {
        const db = await connectToDatabase();
        const userArtworks = await db.collection('artworks').find({ userid: userId }).toArray();
        res.status(200).json(userArtworks);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error fetching user artworks");
    }
});

app.get('/api/users/:userId/info', async (req, res) => {
    const userId = req.params.userId;
    console.log(userId);
    try {
        const db = await connectToDatabase();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId)});
        console.log(user);
        res.status(200).json({name: user.name});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error fetching user name/infos");
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
        const mailCheck = await db.collection('users').findOne({email: email});

        if (mailCheck) {
            res.status(500).send({register: false});
        } else {
            await db.collection('users').insertOne({ name, email, password: hashedPassword, role: 'audience' });
            res.status(200).send({register: true});
        }

    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error registering user");
    }
});

app.post('/api/addartwork', async (req, res) => {
    try {
        const { userid, title, description, typeDesign, price, image } = req.body;
        const db = await connectToDatabase();
        const artwork = { userid, title, description, typeDesign, price, image };
        const result = await db.collection('artworks').insertOne(artwork);
        const insertedArtwork = await db.collection('artworks').findOne({ _id: result.insertedId });
        res.status(200).json({artwork: insertedArtwork, message: true});
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error registering artwork");
    }
});

app.delete('/api/artworks/:artworkId', async (req, res) => {
    const artworkId = req.params.artworkId;
    try {
        const db = await connectToDatabase();
        await db.collection('artworks').deleteOne({ _id: new ObjectId(artworkId) });
        res.status(200).json({ message: 'Artwork deleted successfully' });
    } catch (error) {
        console.error('Error deleting artwork:', error);
        res.status(500).send("Error deleting artwork");
    }
});

app.post('api/users/:userId/cart/:artworkId', async (req, res) => {
    const userId = req.params.userId;
    const artworkId = req.params.artworkId;
    const cartItem = { userId, artworkId };

    try {
        const db = await connectToDatabase();
        await db.collection('carts_items').insertOne(cartItem);
        res.status(200).json({ message: 'Artwork added to the cart succesfuly' });
    } catch (error) {
        console.error('Error adding the artwork to your cart:', error);
        res.status(500).send('Error adding the artwork to your cart');
    }
});

app.delete('api/users/:userId/cart/:artworkId', async (req, res) => {
    const userId = req.params.userId;
    const artworkId = req.params.artworkId;

    try {
        const db = await connectToDatabase();
        await db.collection('artworks').deleteOne({ _id: new ObjectId(artworkId) });
        res.status(200).json({ message: 'Artwork deleted from the cart successfully' });
    } catch (error) {
        console.error('Error deleting the artwork from the cart:', error);
        res.status(500).send("Error deleting artwork from the cart");
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const db = await connectToDatabase();
        const user = await db.collection('users').findOne({ email: email });
        const admin = user.role === 'admin';

        if (!user) {
            return res.status(401).json({ message: 'Email or password is incorrect' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (passwordMatch) {
            const accessToken = jwt.sign({ userId: user._id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            console.log(JSON.stringify(user._id));
            return res.status(200).json({ message: 'Login successful', accessToken: accessToken, user: user, admin:  admin});
        } else {
            return res.status(401).json({ message: 'Email or password is incorrect' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/:artworkId/comments', async (req, res) => {
   try {
       const artwordId = req.params.artworkId;
       const { text, userId } = req.body;
       const db = await connectToDatabase();
       await db.collection('comments').insertOne({ artworkId, userId, text });
       res.status(200).json({ message: 'Comment added to the artwork succesfuly' });
   } catch(e) {
       res.status(500).json({ message: 'Comment error, not successfuly added' })
   }
});

app.get('/api/:artworkId/comments', async (req, res) => {
   try {
       const artworkId = req.params.artworkId;
       const db = connectToDatabase();
       const comments = db.collection('comments').find({}).limit(50).toArray();
       res.send(comments).status(200);
   } catch (e) {
       res.status(500).json({ message: 'Comment error, not successfuly added', error: e})
   }
});

// Save Artwork API
app.post('/api/:userId/saved', async (req, res) => {
    try {
        const userId = req.params.userId;
        const artworkId = req.body;
        const savedArtwork = { userId, artworkId };
        const db = await connectToDatabase();
        await db.collection('saved').insertOne({ savedArtwork });

        res.status(200).json({ message: 'Artwork saved successfully' });
    } catch (e) {
        res.status(500).json({ message: `Could not save artwork: ${e}` });
    }
});

app.get('/api/:userId/saved', async (req, res) => {
    try {
        const userId = req.params.userId;
        const db = await connectToDatabase();
        const savedArtworks = await db.collection('saved').find({ userId: new ObjectId(userId) }).toArray();

        res.status(200).json({ savedArtworks: savedArtworks, message: 'Saved artworks listed successfully' });
    } catch (e) {
        res.status(500).json({ message: `Artworks could not be listed successfully: ${e}` });
    }
});

module.exports = {app, userResults, artworkResults};
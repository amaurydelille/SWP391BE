const express = require('express');
const bodyParser = require('body-parser');
const { connectToDatabase } = require('./mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { editDistance, merge, generatePassword } = require('../services');

const app = express();
const port = 5000;
const cors = require('cors');

const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('../swagger-output.json')

const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // Use `true` for port 465, `false` for all other ports
    auth: {
        user: "secondcyclecontact@gmail.com",
        pass: "ujbo ebkb cacl wlir",
    },
});

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

app.get('/api/homepage/artworks', async (req, res) => {
    try {
        const db = await connectToDatabase();

        const artworkResults = await db.collection('artworks').aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'userid',
                    foreignField: '_id',
                    as: 'user'
                }
            }
        ]).toArray();

        res.status(200).json({ artworks: artworkResults });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error server");
    }
});

// Get Users Artworks
app.get('/api/users/:userId/artworks', async (req, res) => {
    const userId = req.params.userId;
    try {
        const db = await connectToDatabase();
        const userArtworks = await db.collection('artworks').find({ userid: new ObjectId(userId) }).toArray();
        res.status(200).json(userArtworks);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send("Error fetching user artworks");
    }
});

// Update Users Artwork
app.put('/api/users/:userId/artworks/:artworkId', async (req, res) => {
    const userId = req.params.userId;
    const artworkId = req.params.artworkId;

    try {
        const { _id, title, description, typeDesign, price } = req.body;
        const artwork = [ title, description, typeDesign, price ];
        artwork.filter(n => n);
        const db = await connectToDatabase();
        await db.collection('artworks').update({_id: new ObjectId(_id)}, artwork);

        res.status(200).json({ message: "Artwork updated successfully" });
    } catch (e) {
        res.status(500).json({ message: 'Could not update artwork' });
        console.log(`Error updating artwork: ${e}`);
    }
});

app.get('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const db = await connectToDatabase();
        const user = await db.collection('users').find({ _id: new ObjectId(userId) }).toArray();
        res.status(200).json({ user : user });
    } catch (e) {
        res.status(500).json({ message: `Error getting the user: ${e}` });
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
        const artwork = { userid: new ObjectId(userid), title: title, description: description, typeDesign: typeDesign, price: price, image: image, likes: 0 };
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

app.put('/api/artworks/:artworkId', async (req, res) => {
    try {
        const newArtworkData = req.body;
        const artworkId = req.params.artworkId;
        const db = await connectToDatabase();
        await db.collection('artworks').updateOne({ _id: new ObjectId(artworkId) }, { newArtworkData });

        res.status(200).json({ message: 'Artwork data updated successfully' });
    } catch (e) {
        res.status(500).json({ message: `Could not update artwork: ${e}` });
    }
});

app.post('/api/users/:userId/cart/:artworkId', async (req, res) => {
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

app.delete('/api/users/:userId/cart/:artworkId', async (req, res) => {
    const userId = req.params.userId;
    const artworkId = req.params.artworkId;

    try {
        const db = await connectToDatabase();
        await db.collection('carts_items').deleteOne({ _id: new ObjectId(artworkId) });
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

// Change password
app.post('/api/changepassword', async (req, res) => {
    const { email, currentPassword, newPassword } = req.body;

    try {
        const db = await connectToDatabase();
        const user = await db.collection('users').findOne({ email: email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const passwordMatch = await bcrypt.compare(currentPassword, user.password);

        if (passwordMatch) {
            const hashedNewPassword = await bcrypt.hash(newPassword, 10);
            await db.collection('users').updateOne(
                { _id: new ObjectId(user._id) },
                { $set: { password: hashedNewPassword } }
            );

            // generate new token, if needed

            return res.status(200).json({ message: 'Password changed successfully' });
        } else {
            return res.status(401).json({ message: 'Current password is incorrect' });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/send', async (req, res) => {
    try {
        const data = req.body;
        const password = generatePassword(10);

        const info = await transporter.sendMail({
            from: 'secondcyclecontact@gmail.com',
            to: data.mail,
            subject: "Hello here is your new password",
            text: "Do not share this password with anybody: ",
            html: "<b>Votre mot de passe : " + password + "</b>",
        });

        const hashedPassword = await bcrypt.hash(password, 10);
        const db = await connectToDatabase();
        const user = await db.collection('users').updateOne({ email: data.mail }, { $set: { password: hashedPassword } });
        console.log("Mail sent successfully");
        res.status(200).send("Password sent successfully!");
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).send("Error sending email: " + error.message);
    }
});




app.post('/api/:artworkId/comments', async (req, res) => {
   try {
       const artworkId = req.params.artworkId;
       const { text, userId } = req.body;
       const db = await connectToDatabase();
       const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
       await db.collection('comments').insertOne({ artworkId: artworkId, userId: userId, user: user, text: text });
       res.status(200).json({ message: 'Comment added to the artwork successfully' });
   } catch(e) {
       console.log(e);
       res.status(500).json({ message: `Comment error, not successfully added ${e}` })
   }
});

app.get('/api/:artworkId/comments', async (req, res) => {
   try {
       const artworkId = req.params.artworkId;
       const db = await connectToDatabase();
       const comments = await db.collection('comments').find({ artworkId: artworkId }).toArray();
       res.status(200).json({comments: comments});
   } catch (e) {
       res.status(500).json({ message: 'Comment error, not successfully added', error: e})
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

//Unsaved Artwork
app.delete('/api/users/:userId/saved/:artworkId', async (req, res) => {
    const userId = req.params.userId;
    const artworkId = req.params.artworkId;

    try {
        const db = await connectToDatabase();
        await db.collection('saved').deleteOne({ userId: new ObjectId(userId), artworkId: new ObjectId(artworkId) });
        
        res.status(200).json({ message: 'Artwork unsaved successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error unsaving artwork: ${e}` });
    }
});


//Like artwork API
app.post('/api/users/:userId/artworks/:artworkId/likes', async (req, res) => {
    const artworkId = req.params.artworkId;
    const userId = req.params.userId;

    try {
        const db = await connectToDatabase();

        // Find artwork by Id
        const artwork = await db.collection('artworks').findOne({ _id: new ObjectId(artworkId) });

        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        // Increment the 'likes' count
        artwork.likes = (artwork.likes || 0) + 1;

        // Update the artwork with the new 'likes' count
        await db.collection('artworks').updateOne(
            { _id: new ObjectId(artworkId) },
            { $set: { likes: artwork.likes } }
        );

        await db.collection('saved').insertOne({ userId: userId, artworkId: artworkId });

        //res.status(200).json({ likes: artwork.likes, message: 'Artwork liked successfully' });
        res.status(200).json({ message: 'Artwork liked successfully' });
    } catch (e) {
        res.status(500).json({ message: `Could not like artwork: ${e}` });
    }
});

app.get('/api/artworks/:artworkId/likes', async (req, res) => {
    const artworkId = req.params.artworkId;

    try {
        const db = await connectToDatabase();

        // Find the artwork by ID
        const artwork = await db.collection('artworks').findOne({ _id: new ObjectId(artworkId) });

        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        // Get the current 'likes' count
        const likesCount = artwork.likes || 0;

        res.status(200).json({ likes: likesCount, message: 'Likes count retrieved successfully' });
    } catch (e) {
        res.status(500).json({ message: `Likes count could not be retrieve: ${e}` });
    }
});

//Unliked Artwork
app.delete('/api/artworks/:artworkId/likes/:userId', async (req, res) => {
    const artworkId = req.params.artworkId;
    const userId = req.params.userId;

    try {
        const db = await connectToDatabase();
        const artwork = await db.collection('artworks').findOne({ _id: new ObjectId(artworkId) });

        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        if (artwork.likes === 0) {
            return res.status(400).json({ message: 'Artwork has no likes to unlike' });
        }

        // Update likes count
        artwork.likes = Math.max(0, artwork.likes - 1);

        // Update artwork document
        await db.collection('artworks').updateOne(
            { _id: new ObjectId(artworkId) },
            { $set: { likes: artwork.likes } }
        );

        res.status(200).json({ message: 'Artwork unliked successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error unliking artwork: ${e}` });
    }
});


// Send Artwork to Homepage API
app.post('/api/artworks/:artworkId', async (req, res) => {
    try {
        const { userid, title, description, typeDesign, price, image } = req.body;
        const db = await connectToDatabase();
        const artwork = { userid, title, description, typeDesign, price, image, likes: 0 };
        const result = await db.collection('artworks').insertOne(artwork);
        const insertedArtwork = await db.collection('artworks').findOne({ _id: result.insertedId });

        //res.status(200).json({ artwork: insertedArtwork, message: 'Artwork sent to the homepage successfully' });
        res.status(200).json({ message: 'Artwork sent to the homepage successfully' });

    } catch (e) {
        res.status(500).json({ message: `Error sending artwork to the homepage: ${e}` });
    }
});

app.get('/api/artworks/:artworkId', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const homepageArtworks = await db.collection('artworks').find({}).limit(50).toArray();
        res.status(200).json({homepageArtworks, message: `Sending artwork to home page successfully`});
    } catch (e) {
        res.status(500).json({ message: `Artwork could not be send: ${e}`});
    }
});

// Admin CRUD Related APIS
// Create User
app.post('/api/admin/users', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        const user = { name, email, password, role };
        const db = await connectToDatabase();
        await db.collection('users').insertOne(user);

        res.status(200).json({ message: 'User inserted successfully' });
    } catch (e) {
        res.status(500).json({ message: `User could not be inserted: ${e}` });
    }
});

app.get('/api/admin/users', async (req, res) => {
    try {
        const db = await connectToDatabase();
        const users = await db.collection('users').find({}).toArray();

        res.status(200).json({ users: users, message: 'Users could be listed successfully' });
    } catch (e) {
        res.status(500).json({ message: `Users could not be listed: ${e}` });
    }
});

app.put('/api/admin/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { name, email, password, role } = req.body;
        const user = { name, email, password, role };
        const db = await connectToDatabase();
        await db.collection('users').update({ _id: new ObjectId(userId) }, user);

        res.status(200).json({ message: 'User updated successfully' });
    } catch (e) {
        res.status(500).json({ message: `User could not be updated: ${e}` });
    }
});

app.delete('/api/admin/users/:userId', async (req, res) => {
   try {
       const userId = req.params.userId;
       const db = await connectToDatabase();
       await db.collection('users').deleteOne({ _id: new ObjectId(userId) });   

       res.status(200).json({ message: 'User deleted successfully' });
   }  catch (e) {
        res.status(500).json({ message: `User could not be deleted successfully: ${e}` });
   }
});

app.put('/api/users/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { name, mail, password, picture } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = { name, mail, hashedPassword, picture };

        Object.keys(user).forEach(key => user[key] === undefined && delete user[key]);

        const db = await connectToDatabase();
        await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: user });
        console.log('put user', user);

        res.status(200).json({ message: 'User updated successfully' });
    } catch (e) {
        res.status(500).json({ message: `Could not update the user: ${e}` });
        console.log(e);
    }
});

// Follow creator
app.post('/api/users/:userId/follow/:userFollowedId', async (req, res) => {
    try {
        const { userId, userFollowedId } = req.params;
        const db = await connectToDatabase();
        await db.collection('follows').insertOne({ userId: userId, followedUser: userFollowedId });

        res.status(200).json({ message: ('Follow could be inserted successfully') });
    } catch (e) {
        res.status(500).json({ message: `Could not insert follow: ${e}` });
    }
});

// Get follower number
app.get('/api/users/:userId/followers', async (req, res) => {
    try {
        const userId = req.params.userId;
        const db = await connectToDatabase();
        const followers = await db.collection('follows').find({ followedUser: userId }).toArray();

        res.status(200).json({ followers: followers.length });
    } catch (e) {
        res.status(500).json({ message: `Could not get number of followers: ${e}` });
    }
});

// Admin CRUD artwork
app.post('/api/admin/artworks', async (req, res) => {
    try {
        const { userid, title, description, typeDesign, price, image } = req.body;
        const db = await connectToDatabase();
        const artwork = { userid, title, description, typeDesign, price, image, likes: 0 };
        const result = await db.collection('artworks').insertOne(artwork);
        const insertedArtwork = await db.collection('artworks').findOne({ _id: result.insertedId });

        res.status(200).json({ message: 'Artwork created successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error creating artwork: ${e}` });
    }
});

app.get('/api/admin/artworks', async (req, res) => {
    try {
        const artworkId = req.params.artworkId;
        const db = await connectToDatabase();
        const artwork = await db.collection('artworks').findOne({ _id: new ObjectId(artworkId) });

        if (!artwork) {
            return res.status(404).json({ message: 'Artwork not found' });
        }

        res.status(200).json({ artwork: artwork, message: 'Artwork retrieved successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error getting artwork: ${e}` });
    }
});

app.put('/api/admin/artworks/:artworkId', async (req, res) => {
    try {
        const newArtworkData = req.body;
        const artworkId = req.params.artworkId;
        const db = await connectToDatabase();
        await db.collection('artworks').updateOne({ _id: new ObjectId(artworkId) }, { $set: newArtworkData });

        res.status(200).json({ message: 'Artwork updated successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error updating artwork: ${e}` });
    }
});

app.delete('/api/admin/artworks/:artworkId', async (req, res) => {
    const artworkId = req.params.artworkId;
    try {
        const db = await connectToDatabase();
        await db.collection('artworks').deleteOne({ _id: new ObjectId(artworkId) });

        res.status(200).json({ message: 'Artwork deleted successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error deleting artwork: ${e}` });
    }
});

// Admin CRUD orders
app.post('/api/admin/orders', async (req, res) => {
    try {
        const { userId, artworkId, orderDate, quantity, totalAmount, paymentStatus, paymentMethod } = req.body;
        const db = await connectToDatabase();
        const order = { userId, artworkId, orderDate, quantity, totalAmount, paymentStatus, paymentMethod };
        const result = await db.collection('orders').insertOne(order);
        const insertedOrder = await db.collection('orders').findOne({ _id: result.insertedId });

        res.status(200).json({ message: 'Order created successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error creating order: ${e}` });
    }
});

app.get('/api/admin/orders', async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const db = await connectToDatabase();
        const order = await db.collection('orders').findOne({ _id: new ObjectId(orderId) });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json({ order: order, message: 'Order retrieved successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error getting order: ${e}` });
    }
});

app.put('/api/admin/orders/:orderId', async (req, res) => {
    try {
        const newOrderData = req.body;
        const orderId = req.params.orderId;
        const db = await connectToDatabase();
        await db.collection('orders').updateOne({ _id: new ObjectId(orderId) }, { $set: newOrderData });

        res.status(200).json({ message: 'Order updated successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error updating order: ${e}` });
    }
});

app.delete('/api/admin/orders/:orderId', async (req, res) => {
    const orderId = req.params.orderId;
    try {
        const db = await connectToDatabase();
        await db.collection('orders').deleteOne({ _id: new ObjectId(orderId) });

        res.status(200).json({ message: 'Order deleted successfully' });
    } catch (e) {
        res.status(500).json({ message: `Error deleting order: ${e}` });
    }
});

// Search Bar API
app.get('/search/:item', async (req, res) => {
    try {
        const item = req.params.item;
        const db = await connectToDatabase();
        const response = await db.collection('artworks').aggregate([
            {
                $lookup: {
                    from: 'users',
                    localField: 'userid',
                    foreignField: '_id',
                    as: 'user'
                }
            }
        ]).toArray();
        const first = response.filter(x => x.title.toLowerCase().includes(item.toString().toLowerCase()));
        const second = response.filter(x => editDistance(x.title.toString().toLowerCase(), item.toString().toLowerCase()) < 5);

        const artworks = merge(first, second);

        res.status(200).json({ artworks: artworks });
    }
    catch (e) {
        console.log(e)
        res.status(500).json({ message: `Could not get results for this: ${e}` });
    }
});

// Get Users Liked and Saved Artwork API
app.get('/api/users/:userId/saved', async (req, res) => {
    try {
        const userId = req.params.userId;
        const db = await connectToDatabase();
        const savedArtworks = await db.collection('saved').find({userId: userId}).toArray();

        res.status(200).json({ savedArtworks: savedArtworks });
    } catch (e) {
        res.status(500).json({ message: `Could not get saved artworks: ${e}` });
    }
});

app.get('/api/users/:userId/cart', async (req, res) => {
    try {
        const userId = req.params.userId;
        const db = await connectToDatabase();
        const cartArtworks = await db.collection('carts_items').find({ userId: userId }).toArray();

        let cartWithDetails = [];

        for (const cartItem of cartArtworks) {
            const artworkDetails = await db.collection('artworks').findOne({ _id: new ObjectId(cartItem.artworkId) });
            cartItem.artworkDetails = artworkDetails;
            cartWithDetails.push(cartItem);
        }

        res.status(200).json({ cartArtworks: cartWithDetails });
        console.log(cartWithDetails);
    } catch (e) {
        res.status(500).json({ message: `Could not get saved artworks: ${e}` });
    }
});

app.get('/api/users/:userId/cart/artworks/:artworkId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const artworkId = req.params.artworkId;

        const db = await connectToDatabase();
        const added = await db.collection('carts_items').find({ userId: userId, artworkId: artworkId }).toArray();

        if (added.length > 0) {
            res.status(200).json({ added: true });
        } else {
            res.status(200).json({ added: false });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error checking if artwork is added to cart' });
    }
});

app.get('/api/users/:userId/saved/artworks/:artworkId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const artworkId = req.params.artworkId;

        const db = await connectToDatabase();
        const added = await db.collection('saved').find({ userId: userId, artworkId: artworkId }).toArray();

        if (added.length > 0) {
            res.status(200).json({ added: true });
        } else {
            res.status(200).json({ added: false });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error checking if artwork is added to cart' });
    }
});

// PAYMENT APIS
app.delete('/api/payment/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;

        const db = await connectToDatabase();
        await db.collection('carts_item').deleteMany({ _id: new ObjectId(userId) });

        res.status(200).json({ message: 'Payment made successfully' });
    } catch (e) {
        res.status(500).json({ message: `Payment was not made: ${e}` });
    }
});

module.exports = {app, userResults, artworkResults};
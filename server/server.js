const express = require("express");
const bodyParser = require("body-parser");
const { connectToDatabase } = require("./mongodb");
const bcrypt = require("bcrypt");
const session = require("express-session");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { ObjectId } = require("mongodb");
const { editDistance, merge, generatePassword } = require("../services");
const { format } = require("date-fns");

const app = express();
const port = 5000;
const cors = require("cors");

const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("../swagger-output.json");

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

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

const generateSecret = () => {
  return crypto.randomBytes(32).toString("hex");
};

const secret_token = generateSecret();
process.env.ACCESS_TOKEN_SECRET = secret_token;

app.use(bodyParser.json());
const corsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
};

app.use(cors(corsOptions));

app.use(
  session({
    secret: process.env.ACCESS_TOKEN_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      maxAge: 3600,
    },
  })
);

app.get("/", (req, res) => {
  res.send("Backend server");
});

let userResults;
let artworkResults;

app.get("/api/getusers", async (req, res) => {
  try {
    const db = await connectToDatabase();
    userResults = await db.collection("users").find({}).limit(50).toArray();
    res.send(userResults).status(200);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error server");
  }
});

app.get("/api/homepage/artworks", async (req, res) => {
  try {
    const db = await connectToDatabase();

    const artworkResults = await db
      .collection("artworks")
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userid",
            foreignField: "_id",
            as: "user",
          },
        },
      ])
      .toArray();

    res.status(200).json({ artworks: artworkResults });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error server");
  }
});

// Get Users Artworks
app.get("/api/users/:userId/artworks", async (req, res) => {
  const userId = req.params.userId;
  try {
    const db = await connectToDatabase();
    const userArtworks = await db
      .collection("artworks")
      .find({ userid: new ObjectId(userId) })
      .toArray();
    res.status(200).json(userArtworks);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error fetching user artworks");
  }
});

// Update Users Artwork
app.put("/api/users/:userId/artworks/:artworkId", async (req, res) => {
  const userId = req.params.userId;
  const artworkId = req.params.artworkId;

  try {
    const { title, description, price } = req.body;
    const artworkUpdates = { title, description, price };

    const db = await connectToDatabase();
    await db
      .collection("artworks")
      .updateOne({ _id: new ObjectId(artworkId) }, { $set: artworkUpdates });

    res.status(200).json({ message: "Artwork updated successfully" });
  } catch (e) {
    res.status(500).json({ message: "Could not update artwork" });
    console.log(`Error updating artwork: ${e}`);
  }
});

app.get("/api/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();
    const user = await db
      .collection("users")
      .find({ _id: new ObjectId(userId) })
      .toArray();
    res.status(200).json({ user: user });
    console.log(user);
  } catch (e) {
    console.log("error", e);
    res.status(500).json({ message: `Error getting the user: ${e}` });
  }
});

app.get("/api/users/:userId/info", async (req, res) => {
  const userId = req.params.userId;
  console.log(userId);
  try {
    const db = await connectToDatabase();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });
    console.log(user);
    res.status(200).json({ name: user.name });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error fetching user name/infos");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);
    const db = await connectToDatabase();
    const mailCheck = await db.collection("users").findOne({ email: email });

    if (mailCheck) {
      res.status(500).send({ register: false });
    } else {
      await db.collection("users").insertOne({
        name,
        email,
        password: hashedPassword,
        role: "audience",
        balance: 0,
        follow: 0,
      });
      res.status(200).send({ register: true });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error registering user");
  }
});

app.post("/api/addartwork", async (req, res) => {
  try {
    const { userid, title, description, typeDesign, price, image } = req.body;
    const db = await connectToDatabase();
    await db
      .collection("users")
      .updateOne({ _id: new ObjectId(userid) }, { $set: { role: "creator" } });
    const artwork = {
      userid: new ObjectId(userid),
      title: title,
      description: description,
      typeDesign: typeDesign,
      price: price,
      image: image,
      likes: 0,
    };
    const result = await db.collection("artworks").insertOne(artwork);
    const insertedArtwork = await db
      .collection("artworks")
      .findOne({ _id: result.insertedId });
    res.status(200).json({ artwork: insertedArtwork, message: true });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Error registering artwork");
  }
});

app.delete("/api/artworks/:artworkId", async (req, res) => {
  const artworkId = req.params.artworkId;
  try {
    const db = await connectToDatabase();
    await db.collection("artworks").deleteOne({ _id: new ObjectId(artworkId) });
    res.status(200).json({ message: "Artwork deleted successfully" });
  } catch (error) {
    console.error("Error deleting artwork:", error);
    res.status(500).send("Error deleting artwork");
  }
});

app.put("/api/artworks/:artworkId", async (req, res) => {
  try {
    const newArtworkData = req.body;
    const artworkId = req.params.artworkId;
    const db = await connectToDatabase();
    await db
      .collection("artworks")
      .update({ _id: new ObjectId(artworkId) }, { newArtworkData });

    res.status(200).json({ message: "Artwork data updated successfully" });
  } catch (e) {
    res.status(500).json({ message: `Could not update artwork: ${e}` });
  }
});

// app.post("/api/users/:userId/cart/:artworkId", async (req, res) => {
//   const userId = req.params.userId;
//   const artworkId = req.params.artworkId;
//   const cartItem = { userId, artworkId };

//   try {
//     const db = await connectToDatabase();
//     await db.collection("carts_items").insertOne(cartItem);
//     res.status(200).json({ message: "Artwork added to the cart succesfuly" });
//   } catch (error) {
//     console.error("Error adding the artwork to your cart:", error);
//     res.status(500).send("Error adding the artwork to your cart");
//   }
// });
// Dat work
app.post("/api/users/:userId/cart/:artworkId", async (req, res) => {
  const userId = req.params.userId;
  const artworkId = req.params.artworkId;
  const cartItem = { userId, artworkId };

  try {
    const db = await connectToDatabase();
    if (await checkExistsArtworkInTransaction(userId, artworkId)) {
      res;
      res.status(400).json({
        message: "You cannot add to cart your artwork that you already bought",
      });
    } else if (await checkExistsArtworkInCartItem(userId, artworkId)) {
      res;
      res.status(400).json({
        message:
          "You cannot add to cart your artwork that you already exists in shopping cart",
      });
    } else {
      await db.collection("carts_items").insertOne(cartItem);
      res.status(200).json({ message: "Artwork added to the cart succesfuly" });
    }
  } catch (error) {
    console.error("Error adding the artwork to your cart:", error);
    res.status(500).json({ message: "Error adding the artwork to your cart" });
  }
});

// Dat work
// async function checkExistsArtworkInTransaction(userId, artworkId) {
//   try {
//     const db = await connectToDatabase();
//     const artworkCollection = db.collection("transactions");

//     const artwork = await artworkCollection.findOne({
//       artworkId: artworkId,
//       userId: userId,
//     });

//     if (artwork) {
//       return true;
//     } else {
//       return false;
//     }
//   } catch (error) {
//     console.error("Error checking artwork existence in transaction:", error);
//     throw error;
//   }
// }
// Dat work
async function checkExistsArtworkInTransaction(userId, artworkId) {
  try {
    const db = await connectToDatabase();
    const transactionCollection = db.collection("transactions");

    const artwork = await transactionCollection.findOne({
      userId: userId,
      artworkId: new ObjectId(artworkId), // Chuyển đổi artworkId thành ObjectId
    });

    if (artwork) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error checking artwork existence in transaction:", error);
    throw error;
  }
}
// Dat work
async function checkExistsArtworkInCartItem(userId, artworkId) {
  try {
    const db = await connectToDatabase();
    const artworkCollection = db.collection("carts_items");

    const artwork = await artworkCollection.findOne({
      artworkId: artworkId,
      userId: userId,
    });

    if (artwork) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error checking artwork existence in transaction:", error);
    throw error;
  }
}
app.delete("/api/users/:userId/cart/:artworkId", async (req, res) => {
  const userId = req.params.userId;
  const artworkId = req.params.artworkId;

  try {
    const db = await connectToDatabase();
    await db
      .collection("carts_items")
      .deleteOne({ _id: new ObjectId(artworkId) });
    res
      .status(200)
      .json({ message: "Artwork deleted from the cart successfully" });
  } catch (error) {
    console.error("Error deleting the artwork from the cart:", error);
    res.status(500).send("Error deleting artwork from the cart");
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const db = await connectToDatabase();
    const user = await db.collection("users").findOne({ email: email });
    const admin = user.role === "admin";

    if (!user) {
      return res
        .status(401)
        .json({ message: "Email or password is incorrect" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (passwordMatch) {
      const accessToken = jwt.sign(
        { userId: user._id },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "1h" }
      );
      console.log(JSON.stringify(user._id));
      return res.status(200).json({
        message: "Login successful",
        accessToken: accessToken,
        user: user,
        admin: admin,
      });
    } else {
      return res
        .status(401)
        .json({ message: "Email or password is incorrect" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Change password
app.post("/api/changepassword", async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;

  try {
    const db = await connectToDatabase();
    const user = await db.collection("users").findOne({ email: email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (passwordMatch) {
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await db
        .collection("users")
        .updateOne(
          { _id: new ObjectId(user._id) },
          { $set: { password: hashedNewPassword } }
        );

      // generate new token, if needed

      return res.status(200).json({ message: "Password changed successfully" });
    } else {
      return res.status(401).json({ message: "Current password is incorrect" });
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/send", async (req, res) => {
  try {
    const data = req.body;
    const password = generatePassword(10);

    const info = await transporter.sendMail({
      from: "secondcyclecontact@gmail.com",
      to: data.mail,
      subject: "Hello here is your new password",
      text: "Do not share this password with anybody: ",
      html: "<b>Votre mot de passe : " + password + "</b>",
    });

    const hashedPassword = await bcrypt.hash(password, 10);
    const db = await connectToDatabase();
    const user = await db
      .collection("users")
      .updateOne({ email: data.mail }, { $set: { password: hashedPassword } });
    console.log("Mail sent successfully");
    res.status(200).send("Password sent successfully!");
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).send("Error sending email: " + error.message);
  }
});

app.post("/api/:artworkId/comments", async (req, res) => {
  try {
    const date = new Date();
    const actualDate = format(date, "dd/MM/yyyy - HH'h'mm");
    const artworkId = req.params.artworkId;
    const { text, userId } = req.body;
    const db = await connectToDatabase();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });
    await db.collection("comments").insertOne({
      artworkId: artworkId,
      userId: userId,
      user: user,
      text: text,
      date: actualDate,
    });
    res
      .status(200)
      .json({ message: "Comment added to the artwork successfully" });
  } catch (e) {
    console.log(e);
    res
      .status(500)
      .json({ message: `Comment error, not successfully added ${e}` });
  }
});

app.get("/api/:artworkId/comments", async (req, res) => {
  try {
    const artworkId = req.params.artworkId;
    const db = await connectToDatabase();

    let comments = await db
      .collection("comments")
      .find({ artworkId: artworkId })
      .toArray();
    comments = comments.filter(
      (comment) => comment.text && comment.text.trim() !== ""
    );

    res.status(200).json({ comments: comments });
  } catch (e) {
    res
      .status(500)
      .json({ message: "Comment error, not successfully added", error: e });
  }
});

// GET COMMENTS FOR USER
app.get("/api/users/:userId/comments", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();
    const comments = await db
      .collection("comments")
      .find({ userId: userId })
      .toArray();

    res.status(200).json({ comments: comments });
  } catch (e) {
    res.status(500).json({ message: `Could not get comments: ${e}` });
  }
});

// DELETE COMMENTS
app.delete("/api/comment/:commentId", async (req, res) => {
  try {
    const commentId = req.params.commentId;
    const db = await connectToDatabase();
    await db.collection("comments").deleteOne({ _id: new ObjectId(commentId) });
    res.status(200).json({ message: "Comments deleted" });
  } catch (e) {
    res.status(500).json({ message: `Could not delete comment: ${e}` });
  }
});

// Save Artwork API
app.post("/api/:userId/saved", async (req, res) => {
  try {
    const userId = req.params.userId;
    const artworkId = req.body;
    const savedArtwork = { userId, artworkId };
    const db = await connectToDatabase();
    await db.collection("saved").insertOne({ savedArtwork });

    res.status(200).json({ message: "Artwork saved successfully" });
  } catch (e) {
    res.status(500).json({ message: `Could not save artwork: ${e}` });
  }
});

app.get("/api/:userId/saved", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();
    const savedArtworks = await db
      .collection("saved")
      .find({ userId: userId })
      .toArray();

    res.status(200).json({
      savedArtworks: savedArtworks,
      message: "Saved artworks listed successfully",
    });
  } catch (e) {
    res
      .status(500)
      .json({ message: `Artworks could not be listed successfully: ${e}` });
  }
});

//Unsaved Artwork
app.delete("/api/users/:userId/saved/:artworkId", async (req, res) => {
  const userId = req.params.userId;
  const artworkId = req.params.artworkId;

  try {
    const db = await connectToDatabase();
    await db.collection("saved").deleteOne({
      userId: new ObjectId(userId),
      artworkId: new ObjectId(artworkId),
    });

    res.status(200).json({ message: "Artwork unsaved successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error unsaving artwork: ${e}` });
  }
});

//Like artwork API
app.post("/api/users/:userId/artworks/:artworkId/likes", async (req, res) => {
  const artworkId = req.params.artworkId;
  const userId = req.params.userId;

  try {
    const db = await connectToDatabase();

    // Find artwork by Id
    const artwork = await db
      .collection("artworks")
      .findOne({ _id: new ObjectId(artworkId) });

    if (!artwork) {
      return res.status(404).json({ message: "Artwork not found" });
    }

    // Increment the 'likes' count
    artwork.likes = (artwork.likes || 0) + 1;

    // Update the artwork with the new 'likes' count
    await db
      .collection("artworks")
      .updateOne(
        { _id: new ObjectId(artworkId) },
        { $set: { likes: artwork.likes } }
      );

    await db
      .collection("saved")
      .insertOne({ userId: userId, artworkId: artworkId });

    //res.status(200).json({ likes: artwork.likes, message: 'Artwork liked successfully' });
    res.status(200).json({ message: "Artwork liked successfully" });
  } catch (e) {
    res.status(500).json({ message: `Could not like artwork: ${e}` });
  }
});

app.get("/api/artworks/:artworkId/likes", async (req, res) => {
  const artworkId = req.params.artworkId;

  try {
    const db = await connectToDatabase();

    // Find the artwork by ID
    const artwork = await db
      .collection("artworks")
      .findOne({ _id: new ObjectId(artworkId) });

    if (!artwork) {
      return res.status(404).json({ message: "Artwork not found" });
    }

    // Get the current 'likes' count
    const likesCount = artwork.likes || 0;

    res.status(200).json({
      likes: likesCount,
      message: "Likes count retrieved successfully",
    });
  } catch (e) {
    res
      .status(500)
      .json({ message: `Likes count could not be retrieve: ${e}` });
  }
});

//Unliked Artwork
app.delete("/api/artworks/:artworkId/likes/:userId", async (req, res) => {
  const artworkId = req.params.artworkId;
  const userId = req.params.userId;

  try {
    const db = await connectToDatabase();
    const artwork = await db
      .collection("artworks")
      .findOne({ _id: new ObjectId(artworkId) });

    if (!artwork) {
      return res.status(404).json({ message: "Artwork not found" });
    }

    if (artwork.likes === 0) {
      return res
        .status(400)
        .json({ message: "Artwork has no likes to unlike" });
    }

    // Update likes count
    artwork.likes = Math.max(0, artwork.likes - 1);

    // Update artwork document
    await db
      .collection("artworks")
      .updateOne(
        { _id: new ObjectId(artworkId) },
        { $set: { likes: artwork.likes } }
      );

    res.status(200).json({ message: "Artwork unliked successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error unliking artwork: ${e}` });
  }
});

// Send Artwork to Homepage API
app.post("/api/artworks/:artworkId", async (req, res) => {
  try {
    const { userid, title, description, typeDesign, price, image } = req.body;
    const db = await connectToDatabase();
    const artwork = {
      userid,
      title,
      description,
      typeDesign,
      price,
      image,
      likes: 0,
    };
    const result = await db.collection("artworks").insertOne(artwork);
    const insertedArtwork = await db
      .collection("artworks")
      .findOne({ _id: result.insertedId });

    //res.status(200).json({ artwork: insertedArtwork, message: 'Artwork sent to the homepage successfully' });
    res
      .status(200)
      .json({ message: "Artwork sent to the homepage successfully" });
  } catch (e) {
    res
      .status(500)
      .json({ message: `Error sending artwork to the homepage: ${e}` });
  }
});

app.get("/api/artworks/:artworkId", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const homepageArtworks = await db
      .collection("artworks")
      .find({})
      .limit(50)
      .toArray();
    res.status(200).json({
      homepageArtworks,
      message: `Sending artwork to home page successfully`,
    });
  } catch (e) {
    res.status(500).json({ message: `Artwork could not be send: ${e}` });
  }
});

// Admin CRUD Related APIS
// Create User
app.post("/api/admin/users", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const user = { name, email, password, role };
    const db = await connectToDatabase();
    await db.collection("users").insertOne(user);

    res.status(200).json({ message: "User inserted successfully" });
  } catch (e) {
    res.status(500).json({ message: `User could not be inserted: ${e}` });
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const users = await db.collection("users").find({}).toArray();

    res
      .status(200)
      .json({ users: users, message: "Users could be listed successfully" });
  } catch (e) {
    res.status(500).json({ message: `Users could not be listed: ${e}` });
  }
});

app.put("/api/admin/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const { name, email, password, role } = req.body;
    const user = { name, email, password, role };
    const db = await connectToDatabase();
    await db.collection("users").update({ _id: new ObjectId(userId) }, user);

    res.status(200).json({ message: "User updated successfully" });
  } catch (e) {
    res.status(500).json({ message: `User could not be updated: ${e}` });
  }
});

app.delete("/api/admin/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();
    await db.collection("users").deleteOne({ _id: new ObjectId(userId) });

    res.status(200).json({ message: "User deleted successfully" });
  } catch (e) {
    res
      .status(500)
      .json({ message: `User could not be deleted successfully: ${e}` });
  }
});

app.put("/api/users/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const { name, email, password, picture } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { name, email, password: hashedPassword };

    Object.keys(user).forEach(
      (key) => user[key] === undefined && delete user[key]
    );

    const db = await connectToDatabase();
    await db
      .collection("users")
      .updateOne({ _id: new ObjectId(userId) }, { $set: user });
    console.log("put user", user);

    res.status(200).json({ message: "User updated successfully" });
  } catch (e) {
    res.status(500).json({ message: `Could not update the user: ${e}` });
    console.log(e);
  }
});

// Follow creator

app.post("/api/users/:userId/follow/:creatorId", async (req, res) => {
  try {
    const { userId, creatorId } = req.params;
    const db = await connectToDatabase();
    await db
      .collection("follows")
      .insertOne({ userId: userId, creatorId: creatorId });
    res.status(200).json({ message: "Follow could be inserted successfully" });
  } catch (e) {
    res.status(500).json({ message: `Could not insert follow: ${e}` });
  }
});

// Get a follow couple
app.get("/api/users/:userId/follow/:creatorId", async (req, res) => {
  try {
    const { userId, creatorId } = req.params;
    const db = await connectToDatabase();
    const follow = await db
      .collection("follows")
      .find({ userId: userId, creatorId: creatorId })
      .toArray();
    if (follow.length > 0) res.status(200).json({ follow: true });
    else res.status(200).json({ follow: false });
  } catch (e) {
    res.status(500).json({ message: `Could not get follow: ${e}` });
  }
});

// Unfollow a creator
app.delete("/api/users/:userId/follow/:creatorId", async (req, res) => {
  try {
    const { userId, creatorId } = req.params;
    const db = await connectToDatabase();
    await db
      .collection("follows")
      .deleteOne({ userId: userId, creatorId: creatorId });

    res.status(200).json({ message: "Creator unfollowed successfully" });
  } catch (e) {
    res.status(500).json({ message: `Creator could not be unfollowed: ${e}` });
  }
});

// Get follower number
app.get("/api/users/:creatorId/followers", async (req, res) => {
  try {
    const creatorId = req.params.creatorId;
    const db = await connectToDatabase();
    const followers = await db
      .collection("follows")
      .find({ creatorId: creatorId })
      .toArray();

    res.status(200).json({ followers: followers.length });
  } catch (e) {
    res
      .status(500)
      .json({ message: `Could not get number of followers: ${e}` });
  }
});

// Admin CRUD artwork
app.post("/api/admin/artworks", async (req, res) => {
  try {
    const { userid, title, description, typeDesign, price, image } = req.body;
    const db = await connectToDatabase();
    const artwork = {
      userid,
      title,
      description,
      typeDesign,
      price,
      image,
      likes: 0,
    };
    const result = await db.collection("artworks").insertOne(artwork);
    const insertedArtwork = await db
      .collection("artworks")
      .findOne({ _id: result.insertedId });

    res.status(200).json({ message: "Artwork created successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error creating artwork: ${e}` });
  }
});

app.get("/api/admin/artworks", async (req, res) => {
  try {
    const artworkId = req.params.artworkId;
    const db = await connectToDatabase();
    const artwork = await db
      .collection("artworks")
      .findOne({ _id: new ObjectId(artworkId) });

    if (!artwork) {
      return res.status(404).json({ message: "Artwork not found" });
    }

    res
      .status(200)
      .json({ artwork: artwork, message: "Artwork retrieved successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error getting artwork: ${e}` });
  }
});

app.put("/api/admin/artworks/:artworkId", async (req, res) => {
  try {
    const newArtworkData = req.body;
    const artworkId = req.params.artworkId;
    const db = await connectToDatabase();
    await db
      .collection("artworks")
      .updateOne({ _id: new ObjectId(artworkId) }, { $set: newArtworkData });

    res.status(200).json({ message: "Artwork updated successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error updating artwork: ${e}` });
  }
});

app.delete("/api/admin/artworks/:artworkId", async (req, res) => {
  const artworkId = req.params.artworkId;
  try {
    const db = await connectToDatabase();
    await db.collection("artworks").deleteOne({ _id: new ObjectId(artworkId) });

    res.status(200).json({ message: "Artwork deleted successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error deleting artwork: ${e}` });
  }
});

// Admin CRUD orders
app.post("/api/admin/orders", async (req, res) => {
  try {
    const {
      userId,
      artworkId,
      orderDate,
      quantity,
      totalAmount,
      paymentStatus,
      paymentMethod,
    } = req.body;
    const db = await connectToDatabase();
    const order = {
      userId,
      artworkId,
      orderDate,
      quantity,
      totalAmount,
      paymentStatus,
      paymentMethod,
    };
    const result = await db.collection("orders").insertOne(order);
    const insertedOrder = await db
      .collection("orders")
      .findOne({ _id: result.insertedId });

    res.status(200).json({ message: "Order created successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error creating order: ${e}` });
  }
});

app.get("/api/admin/orders", async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const db = await connectToDatabase();
    const order = await db
      .collection("orders")
      .findOne({ _id: new ObjectId(orderId) });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res
      .status(200)
      .json({ order: order, message: "Order retrieved successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error getting order: ${e}` });
  }
});

app.put("/api/admin/orders/:orderId", async (req, res) => {
  try {
    const newOrderData = req.body;
    const orderId = req.params.orderId;
    const db = await connectToDatabase();
    await db
      .collection("orders")
      .updateOne({ _id: new ObjectId(orderId) }, { $set: newOrderData });

    res.status(200).json({ message: "Order updated successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error updating order: ${e}` });
  }
});

app.delete("/api/admin/orders/:orderId", async (req, res) => {
  const orderId = req.params.orderId;
  try {
    const db = await connectToDatabase();
    await db.collection("orders").deleteOne({ _id: new ObjectId(orderId) });

    res.status(200).json({ message: "Order deleted successfully" });
  } catch (e) {
    res.status(500).json({ message: `Error deleting order: ${e}` });
  }
});

// Search Bar API
app.get("/search/:item", async (req, res) => {
  try {
    const item = req.params.item;
    const db = await connectToDatabase();
    const response = await db
      .collection("artworks")
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userid",
            foreignField: "_id",
            as: "user",
          },
        },
      ])
      .toArray();
    const first = response.filter((x) =>
      x.title.toLowerCase().includes(item.toString().toLowerCase())
    );
    const second = response.filter(
      (x) =>
        editDistance(
          x.title.toString().toLowerCase(),
          item.toString().toLowerCase()
        ) < 5
    );

    const artworks = merge(first, second);

    res.status(200).json({ artworks: artworks });
  } catch (e) {
    console.log(e);
    res.status(500).json({ message: `Could not get results for this: ${e}` });
  }
});

// Get Users Liked and Saved Artwork API
app.get("/api/users/:userId/saved", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();
    const savedArtworks = await db
      .collection("saved")
      .find({ userId: userId })
      .toArray();

    res.status(200).json({ savedArtworks: savedArtworks });
  } catch (e) {
    res.status(500).json({ message: `Could not get saved artworks: ${e}` });
  }
});

app.get("/api/users/:userId/cart", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();
    const cartArtworks = await db
      .collection("carts_items")
      .find({ userId: userId })
      .toArray();

    let cartWithDetails = [];

    for (const cartItem of cartArtworks) {
      const artworkDetails = await db
        .collection("artworks")
        .findOne({ _id: new ObjectId(cartItem.artworkId) });
      cartItem.artworkDetails = artworkDetails;
      cartWithDetails.push(cartItem);
    }

    res.status(200).json({ cartArtworks: cartWithDetails });
    console.log(cartWithDetails);
  } catch (e) {
    res.status(500).json({ message: `Could not get saved artworks: ${e}` });
  }
});

app.get("/api/users/:userId/cart/artworks/:artworkId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const artworkId = req.params.artworkId;

    const db = await connectToDatabase();
    const added = await db
      .collection("carts_items")
      .find({ userId: userId, artworkId: artworkId })
      .toArray();

    if (added.length > 0) {
      res.status(200).json({ added: true });
    } else {
      res.status(200).json({ added: false });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error checking if artwork is added to cart" });
  }
});

app.get("/api/users/:userId/saved/artworks/:artworkId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const artworkId = req.params.artworkId;

    const db = await connectToDatabase();
    const added = await db
      .collection("saved")
      .find({ userId: userId, artworkId: artworkId })
      .toArray();

    if (added.length > 0) {
      res.status(200).json({ added: true });
    } else {
      res.status(200).json({ added: false });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error checking if artwork is added to cart" });
  }
});

// PAYMENT APIS
app.delete("/api/payment/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const db = await connectToDatabase();
    const date = new Date();
    const actualDate = format(date, "dd/MM/yyyy - HH'h'mm");
    const items = await db
      .collection("carts_items")
      .find({ userId: userId })
      .toArray();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });
    for (const item of items) {
      const artwork = await db
        .collection("artworks")
        .findOne({ _id: new ObjectId(item.artworkId) });
      const creator = await db
        .collection("users")
        .findOne({ _id: new ObjectId(userId) });
      await db.collection("transactions").insertOne({
        userId: userId,
        artworkId: item.artworkId,
        artwork: artwork,
        user: user,
        creator: creator,
        transac_time: actualDate,
      });

      await db.collection("carts_items").deleteMany({ userId: userId });
    }

    res.status(200).json({ message: "Payment made successfully" });
  } catch (e) {
    res.status(500).json({ message: `Payment was not made: ${e}` });
  }
});

// API TO SEE WHO BOUGHT AN ARTWORK (CREATOR POV)
app.get("/api/users/:userId/sold/", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();

    const transactions = await db
      .collection("transactions")
      .aggregate([
        {
          $match: {
            userId: new ObjectId(userId),
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "userId", //new ObjectId("userId")
            foreignField: "_id",
            as: "user",
          },
        },
      ])
      .toArray();

    res.status(200).json({ transactions: transactions });
  } catch (error) {
    console.log("error", error);
    res.status(500).json({
      message: `Une erreur s'est produite lors de la récupération des transactions : ${error}`,
    });
  }
});

// Dat work
app.post("/api/users/:userId/artworks/:artworkId/like", async (req, res) => {
  const artworkId = req.params.artworkId;
  const userId = req.params.userId;

  try {
    const db = await connectToDatabase();

    const result = await db
      .collection("artworks")
      .updateOne({ _id: new ObjectId(artworkId) }, { $inc: { likes: 1 } });

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Artwork not found" });
    }

    await db
      .collection("saved")
      .insertOne({ userId: userId, artworkId: artworkId });

    res.status(200).json({ message: "Artwork liked successfully" });
  } catch (e) {
    res.status(500).json({ message: `Could not like artwork: ${e}` });
  }
});

// Dat work
app.post("/api/users/:userId/artworks/:artworkId/unlike", async (req, res) => {
  const artworkId = req.params.artworkId;
  const userId = req.params.userId;

  try {
    const db = await connectToDatabase();

    const result = await db
      .collection("artworks")
      .updateOne({ _id: new ObjectId(artworkId) }, { $inc: { likes: -1 } });

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Artwork not found" });
    }

    await db
      .collection("saved")
      .deleteOne({ userId: userId, artworkId: artworkId });

    res.status(200).json({ message: "Artwork unliked successfully" });
  } catch (e) {
    res.status(500).json({ message: `Could not unlike artwork: ${e}` });
  }
});

module.exports = { app, userResults, artworkResults };

// Dat work
app.get("/api/users/:userId/history/", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();
    const transactions = await db
      .collection("transactions")
      .find({ userId: userId })
      .toArray();

    var list_art = [];
    for (const art of transactions) {
      const art_id = art.artworkId;
      const artwork = await db
        .collection("artworks")
        .findOne({ _id: new ObjectId(art_id) });
      if (artwork) {
        const user = await db
          .collection("users")
          .findOne({ _id: new ObjectId(artwork.userid) });
        if (user) {
          artwork.creator = user.name;
        }
        list_art.push(artwork);
      }
    }

    res.status(200).json({ list_artwork_of_user: list_art });
  } catch (error) {
    res.status(500).json({
      message: `cannot get history : ${error}`,
    });
  }
});

// Amaury: GET TRANSACTIONS
app.get("/api/transactions", async (req, res) => {
  try {
    const db = await connectToDatabase();
    const transactions = await db
      .collection("transactions")
      .aggregate([
        {
          $lookup: {
            from: "users",
            localField: "artwork.userid",
            foreignField: "_id",
            as: "creator ",
          },
        },
      ])
      //.find({})
      .toArray();

    res.status(200).json({ transactions: transactions });
  } catch (e) {
    res.status(500).json({ message: `Could not get every transactions: ${e}` });
    console.log("ERROR GET TRANSACTIONS: ", e);
  }
});

// GET TRANSACTION FOR A USER
app.get("/api/transactions/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();
    const transactions = await db
      .collection("transactions")
      .find({ userId: userId })
      .toArray();

    res.status(200).json({ transactions: transactions });
  } catch (e) {
    res.status(500).json({ message: `Could not get users transactions: ${e}` });
  }
});

// CAREFUL THIS API DELETE EVERYTHING
app.delete("/api/delete", async (req, res) => {
  try {
    const db = await connectToDatabase();

    await db.collection("users").deleteMany({ name: { $ne: "admin Edited" } });

    await Promise.all([
      db.collection("artworks").deleteMany({}),
      db.collection("comments").deleteMany({}),
      db.collection("carts_items").deleteMany({}),
      db.collection("saved").deleteMany({}),
      db.collection("transactions").deleteMany({}),
      db.collection("follows").deleteMany({}),
    ]);

    res
      .status(200)
      .send(
        "Toutes les données ont été supprimées sauf l'utilisateur 'admin Edited'"
      );
  } catch (error) {
    console.error("Erreur lors de la suppression des données:", error);
    res
      .status(500)
      .send("Une erreur s'est produite lors de la suppression des données.");
  }
});

// Dat work
async function handleSaveHistoryTransaction(
  fromUser,
  toUser,
  description,
  type
) {
  try {
    const date = new Date();
    const actualDate = format(date, "dd/MM/yyyy - HH'h'mm");
    const db = await connectToDatabase();

    // Chuyển đổi fromUserId và toUserId thành ObjectId nếu chúng không phải là ObjectId
    const fromUserId = new ObjectId(fromUser);
    const toUserId = new ObjectId(toUser);

    await db.collection("history_transactions").insertOne({
      fromUserId,
      toUserId,
      description,
      dateTime: actualDate,
      type,
    });

    return true;
  } catch (err) {
    console.log("Err when save history transaction: ", err);
    return false;
  }
}

// DAT WORK
app.post("/api/paymentv2/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;
    const db = await connectToDatabase();

    // list artwork in cart_items of user with id: userId
    const items = await db
      .collection("carts_items")
      .find({ userId: userId })
      .toArray();

    // lấy ra list artworkID trong list cart_items mà userId = userId
    const artworkIds = items.map((item) => item.artworkId);
    const artworks = await db
      .collection("artworks")
      .find({ _id: { $in: artworkIds.map((id) => new ObjectId(id)) } })
      .toArray();

    var totalAmount = 0; // tính tổng số tiền của các artwork trong cart-items của user đó
    for (const item of artworks) {
      //console.log("price: ", item.price);
      if (!isNaN(parseFloat(item.price))) {
        // Chuyển đổi item.price từ chuỗi sang số và cộng vào totalAmount
        totalAmount += parseFloat(item.price);
      }
    }

    if (
      (await handleDecreaseBalancefromCustomers(db, totalAmount, userId)) ===
      false
    ) {
      res
        .status(400)
        .json({ message: `user donnot have enough money to purchase` });
      return;
    }

    if (
      (await handleIncreaseBalanceToCreatorAndDivideToAdmin(
        db,
        artworks,
        userId
      )) === false
    ) {
      res.status(400).json({
        message: `something go wrong went increase balance for creator and admin`,
      });
      return;
    }

    await handleCommitTransactionAfterPurchaseSuccess(db, artworks, userId);
    await handleDelectCartItemAfterTransactionsSuccess(db, userId);

    res
      .status(200)
      .json({ message: "Payment made successfully", totalAmount: totalAmount });
  } catch (e) {
    res.status(500).json({ message: `Payment was not made: ${e}` });
  }
});

async function handleDecreaseBalancefromCustomers(db, totalAmount, userId) {
  const user = await db
    .collection("users")
    .findOne({ _id: new ObjectId(userId) });

  if (!user) {
    console.log("User not found");
    return false;
  }

  const userBalance = parseFloat(user.balance);

  if (isNaN(userBalance)) {
    console.log("Invalid user balance");
    return false;
  }

  if (userBalance < totalAmount) {
    console.log("user's balance is not enough to purchase");
    return false;
  }

  // Tính toán giá trị mới của balance
  const newBalance = userBalance - totalAmount;

  // Cập nhật giá trị balance mới vào cơ sở dữ liệu
  const result = await db
    .collection("users")
    .updateOne(
      { _id: new ObjectId(userId) },
      { $set: { balance: newBalance } }
    );

  if (result.modifiedCount === 1) {
    console.log("Balance updated successfully");
    await handleSaveHistoryTransaction(
      user._id,
      user._id,
      user.name +
        " makes payment for the artwork in the shopping cart: - " +
        totalAmount +
        "$",
      "checkout"
    );
    return true;
  } else {
    console.log("Failed to update balance");
    return false;
  }
}

async function handleIncreaseBalanceToCreatorAndDivideToAdmin(
  db,
  list_artwork_from_cart_item,
  userId
) {
  try {
    const customer = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });
    const usersCollection = db.collection("users");

    for (const artwork of list_artwork_from_cart_item) {
      const creatorid = artwork.userid;
      const creatorIdString = creatorid._id
        ? creatorid._id.toString()
        : creatorid.toString();
      const price = parseInt(artwork.price); // Chuyển giá thành số nguyên

      // Tính toán số tiền cho người dùng và admin
      const amountForUser = price * 0.9; // 90% cho người dùng
      const amountForAdmin = price * 0.1; // 10% cho admin

      // Cập nhật balance cho người dùng và admin
      await usersCollection.updateOne(
        { _id: creatorid },
        { $inc: { balance: amountForUser } }
      );
      await handleSaveHistoryTransaction(
        userId,
        creatorIdString,
        customer.name +
          " bought artwork: " +
          artwork.title +
          " ~ + " +
          amountForUser +
          "$",
        "creator_profit"
      );

      // Cập nhật balance cho admin (giả sử admin có ID là 'admin_id')
      await usersCollection.updateOne(
        { email: "admindat@gmail.com" },
        { $inc: { balance: amountForAdmin } }
      );
      await handleSaveHistoryTransaction(
        userId,
        "6607d3bda9d50dd8fcdf5724",
        "admin receives 10% from artwork: " +
          artwork.title +
          " + " +
          amountForAdmin +
          "$",
        "admin_profit"
      );
    }

    console.log("Balance updated successfully.");
  } catch (error) {
    console.error("Error updating balance:", error);
  }
}

async function handleCommitTransactionAfterPurchaseSuccess(
  db,
  list_artwork_from_cart_item,
  userId
) {
  try {
    const transactionsCollection = db.collection("transactions");

    for (const artwork of list_artwork_from_cart_item) {
      const artworkId = artwork._id;

      // Tạo một bản ghi mới trong collection transactions
      await transactionsCollection.insertOne({
        userId: userId,
        artworkId: artworkId,
        artwork: artwork,
      });
    }

    console.log("Transactions committed successfully.");
  } catch (error) {
    console.error("Error committing transactions:", error);
  }
}

async function handleDelectCartItemAfterTransactionsSuccess(db, userId) {
  await db.collection("carts_items").deleteMany({ userId: userId });
}

app.put("/api/users/:userId/balance", async (req, res) => {
  try {
    const userId = req.params.userId;
    const amount = parseInt(req.body);
    const db = await connectToDatabase();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });
    const balance = parseInt(user.balance);
    await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(userId) },
        { $set: { balance: balance + amount } }
      );
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .send("Erreur lors de la mise à jour du solde de l'utilisateur.");
  }
});

// POST HISTORY TRANSACTIONS
app.post("/api/historytransactions", async (req, res) => {
  try {
    const { fromUserId, toUserId, description, type } = req.body;
    const date = new Date();
    const actualDate = format(date, "dd/MM/yyyy - HH'h'mm");
    const db = await connectToDatabase();
    await db.collection("history_transactions").insertOne({
      fromUserId: fromUserId,
      toUserId: toUserId,
      description: description,
      dateTime: actualDate,
      type: type,
    });
    res
      .status(200)
      .json({ message: "Posted history transaction successfully" });
  } catch (e) {
    res.status(500).json({ message: `Could not post transaction: ${e}` });
  }
});

// Datwork - Deposit money to user's account
app.post("/api/deposit/:userid", async (req, res) => {
  try {
    const userId = req.params.userid;
    const db = await connectToDatabase();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(userId) });

    if (!user) {
      console.log("User not found");
      return res.status(404).json({ error: "User not found" });
    }

    const userBalance = parseFloat(user.balance);
    if (isNaN(userBalance)) {
      console.log("Invalid user balance");
      return res.status(400).json({ error: "Invalid user balance" });
    }

    const { amount } = req.body;
    const depositAmount = parseFloat(amount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      return res.status(400).json({ error: "Invalid deposit amount" });
    }

    const newBalance = userBalance + depositAmount;
    const result = await db
      .collection("users")
      .updateOne(
        { _id: new ObjectId(userId) },
        { $set: { balance: newBalance } }
      );

    if (result.modifiedCount === 1) {
      console.log("Balance updated successfully");
      await handleSaveHistoryTransaction(
        user._id,
        user._id,
        `${user.name} deposited (+${depositAmount}$) to account`,
        "deposit"
      );
      return res.status(200).json({ message: "Deposit successful" });
    } else {
      console.log("Error updating balance");
      return res.status(500).json({ error: "Error updating balance" });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// dat work
app.get("/api/payment-history/:userid", async (req, res) => {
  try {
    const userId = req.params.userid;
    const db = await connectToDatabase();

    const paymentHistory = await db
      .collection("history_transactions")
      .find({
        fromUserId: new ObjectId(userId),
        toUserId: new ObjectId(userId),
      })
      .toArray();

    if (paymentHistory.length === 0) {
      return res.status(404).json({ message: "Payment history not found" });
    }

    res.status(200).json({ data: paymentHistory });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: `Could not get payment history: ${e}` });
  }
});

// Dat work -
app.get("/api/customer-order-history/:creatorid", async (req, res) => {
  try {
    const creatorId = req.params.creatorid;
    const db = await connectToDatabase();

    const customerOrderHistory = await db
      .collection("history_transactions")
      .find({
        toUserId: new ObjectId(creatorId),
        type: "creator_profit",
      })
      .toArray();

    if (customerOrderHistory.length === 0) {
      return res
        .status(404)
        .json({ message: "Customer order history not found" });
    }

    res.status(200).json({ data: customerOrderHistory });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ message: `Could not get customer order history: ${e}` });
  }
});

// Dat work -
app.get("/api/admin-profit-history/:adminid", async (req, res) => {
  try {
    const adminId = req.params.adminid;
    const db = await connectToDatabase();

    const adminProfitHistory = await db
      .collection("history_transactions")
      .find({
        toUserId: new ObjectId(adminId),
        type: "admin_profit",
      })
      .toArray();

    if (adminProfitHistory.length === 0) {
      return res
        .status(404)
        .json({ message: "Admin profit history not found" });
    }

    res.status(200).json({ data: adminProfitHistory });
  } catch (e) {
    console.error(e);
    res
      .status(500)
      .json({ message: `Could not get admin profit history: ${e}` });
  }
});
module.exports = { app, userResults, artworkResults };

const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const client = new MongoClient(`${process.env.DATABASE_LOCAL}`, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("taskNestleDB").collection("users");
    const assetCollection = client.db("taskNestleDB").collection("assets");
    const assetCustomRequestCollection = client
      .db("taskNestleDB")
      .collection("customRequest");

    // user set to database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get to user role
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // asset request data
    app.post("/asset-request", async (req, res) => {
      const asset = req.body;
      const result = await assetCustomRequestCollection.insertOne(asset);
      res.send(result);
    });

    app.get("/custom-assets/:email", async (req, res) => {
      const email = req.params.email;
      const result = await assetCustomRequestCollection
        .find({ email })
        .toArray();
      res.send(result);
    });

    app.get("/custom-asset/:id", async (req, res) => {
      const id = req.params.id;
      //console.log(id);
      const result = await assetCustomRequestCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // update asset
    app.patch("/asset-update/:id", async (req, res) => {
      const asset = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateAsset = {
        $set: {
          name: asset.name,
          price: asset.price,
          assetType: asset.assetType,
          image: asset.image,
          assetInfo: asset.assetInfo,
          additional: asset.additional,
        },
      };
      const result = assetCustomRequestCollection.updateOne(
        filter,
        updateAsset
      );
      res.send(result);
    });

    // admin area
    app.post("/add-product", async (req, res) => {
      const asset = req.body;
      const result = await assetCollection.insertOne(asset);
      res.send(result);
    });





    // google login user
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const options = { upsert: true };
      const isExist = await usersCollection.findOne(query);
      console.log("user found", isExist);
      if (isExist) return res.send(isExist);
      const result = await usersCollection.updateOne(
        query,
        {
          $set: { ...user },
        },
        options
      );
      res.send(result);
    });

    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("TaskNestle server is running ");
});
app.listen(port, () => {
  console.log(`server is running on port ${port}`);
});

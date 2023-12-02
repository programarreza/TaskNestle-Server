const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
    const paymentCollection = client.db("taskNestleDB").collection("payments");
    const packageCollection = client.db("taskNestleDB").collection("package");
    const assetRequestCollection = client
      .db("taskNestleDB")
      .collection("requestAssets");
    const assetCustomRequestCollection = client
      .db("taskNestleDB")
      .collection("customRequest");

    // user set to database
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // get to user employee role
    app.get("/users", async (req, res) => {
      const result = await usersCollection.find({ role: "employee" }).toArray();
      res.send(result);
    });

    app.get("/normalUsers", async (req, res) => {
      const result = await usersCollection.find({ role: "user" }).toArray();
      res.send(result);
      console.log(result);
    });

  
    // app.get("/all-users", async (req, res) => {
    //   const result = await usersCollection.find().toArray();
    //   res.send(result);
    // });

    // get pending role user
    app.get("/pendingUser/:email", async (req, res) => {
      const query = { role: "pending", email: req.params.email };
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    // get to specific user
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    // update user role add to admin team
    app.patch("/addedTeam/:id", async (req, res) => {
      const addTeam = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateAddTeam = {
        $set: {
          role: 'employee',
          adminEmail: addTeam.email
        },
      };
      const result = usersCollection.updateOne(filter, updateAddTeam);
      res.send(result);
    });

    // all product get
    app.get("/assets", async (req, res) => {

      const queryObj = {}
      const name = req.query.name
      const type = req.query.type

      if(name){
        queryObj.name = {$regex: new RegExp(name, 'i')} ;
      }
      if(type){
        queryObj.type = {$regex: new RegExp(type)} 
      }
      const result = await assetCollection.find(queryObj).toArray();
      res.send(result);
    });

    // delete user
    app.delete("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await usersCollection.deleteOne(query);
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

    // request asset
    app.post("/request-asset", async (req, res) => {
      const asset = req.body;
      const result = await assetRequestCollection.insertOne(asset);
      res.send(result);
    });

    // get all request asset
    app.get("/request-asset/:adminEmail", async (req, res) => {
      const adminEmail = req.params.adminEmail;
      const queryObj = {
        adminEmail,
      }
      const email = req.query.email
      // const type = req.query.type

      if(email){
        queryObj.email = {$regex: new RegExp(email, 'i')} ;
      }
      // if(type){
      //   queryObj.type = {$regex: new RegExp(type)} 
      // }
      const result = await assetRequestCollection.find(queryObj).toArray();
      res.send(result);
    });

    // get all pending request asset
    app.get("/pending-assets/:email", async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
        status: "pending",
      };
      const result = await assetRequestCollection.find(query).toArray();
      res.send(result);
    });

    // my requested asset
    app.get("/request-assets/:email", async (req, res) => {
      const adminEmail = req.params.email;
      const queryObj = {
        adminEmail,
      }
      const name = req.query.name
      const type = req.query.type

      if(name){
        queryObj.name = {$regex: new RegExp(name, 'i')} ;
      }
      if(type){
        queryObj.type = {$regex: new RegExp(type)} 
      }
      const result = await assetRequestCollection.find(queryObj).toArray();
      res.send(result);
    });



    // delete
    app.delete("/request-asset/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetRequestCollection.deleteOne(query);
      res.send(result);
    });

    // update request asset to returned
    app.patch("/request-asset/:id", async (req, res) => {
      const asset = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateAsset = {
        $set: {
          status: asset.status,
        },
      };
      const result = assetRequestCollection.updateOne(filter, updateAsset);
      res.send(result);
    });

    // update request asset to approve
    app.patch("/request-asset-update/:id", async (req, res) => {
      const asset = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateAsset = {
        $set: {
          status: asset.status,
          approvedDate: asset.approvedDate,
        },
      };
      const result = assetRequestCollection.updateOne(filter, updateAsset);
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

    // get all assets access only admin 
    app.get("/assets/:email", async (req, res) => {
      const email = req.params.email;

      const queryObj = {
        email,
      }
      const sortObj = {}

      const name = req.query.name
      const type = req.query.type
      const sortField = req.query.sortField
      const sortOrder = req.query.sortOrder


      if(name){
        queryObj.name = {$regex: new RegExp(name, 'i')} ;
      }
      if(type){
        queryObj.type = {$regex: new RegExp(type)} 
      }
      if(sortField && sortOrder){
        sortObj[sortField] = sortOrder
      }

      const result = await assetCollection.find(queryObj).sort(sortObj).toArray();
      res.send(result);
    });


    // single asset delete
    app.delete("/asset/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/asset/:id", async (req, res) => {
      const id = req.params.id;
      const result = await assetCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // all custom asset get
    app.get("/custom-asset", async (req, res) => {
      const result = await assetCustomRequestCollection.find().toArray();
      res.send(result);
    });

    // custom asset request reject
    app.delete("/custom-asset/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetCustomRequestCollection.deleteOne(query);
      res.send(result);
    });

    // update custom asset to approve
    app.patch("/custom-asset-update/:id", async (req, res) => {
      const asset = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateAsset = {
        $set: {
          status: asset.status,
        },
      };
      const result = assetCustomRequestCollection.updateOne(
        filter,
        updateAsset
      );
      res.send(result);
    });

    // single product update
    app.patch("/product-update/:id", async (req, res) => {
      const asset = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateProduct = {
        $set: {
          name: asset.name,
          quantity: asset.quantity,
          type: asset.type,
        },
      };
      const result = assetCollection.updateOne(filter, updateProduct);
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

    // payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      console.log(price);
      const amount = parseInt(price * 100);
      console.log(amount, "amount inside the intent");

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", async (req, res) => {
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);

      let limit = payment.limit;
      if (payment.limit === 5) {
        limit = 5;
      } else if (payment.limit === 8) {
        limit = 10;
      } else if (payment.limit === 15) {
        limit = 20;
      } else {
        console.log("Unknown limit value:", limit);
      }

      console.log(334, limit);

      const updateProduct = {
        $set: {
          role: "admin",
          // limit: limit,
        },
        $inc: {
          limit: limit,
        },
      };

      const updateResult = await usersCollection.updateOne(
        { email: payment.email },
        updateProduct
      );
      res.send({ paymentResult, updateResult });
    });

    // package item
    app.get("/packages", async (req, res) => {
      const result = await packageCollection.find().toArray();
      res.send(result);
    });

    // get single package
    app.get("/singePackage/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await packageCollection.findOne(query);
      res.send(result);
      console.log(result);
    });

    // await client.connect();
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

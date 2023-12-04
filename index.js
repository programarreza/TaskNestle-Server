const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
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

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // middleware
    const verifyToken = (req, res, next) => {
      console.log("inside verify token", req.headers.authorization); //token recived
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "forbidden access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: "forbidden access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    //  verify admin after verifyToken
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user?.role === "admin";

      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // user verify admin after verifyToken
    // const verifyEmployee = async (req, res, next) => {
    //   const email = req.decoded.email;
    //   const query = { email: email };
    //   const user = await usersCollection.findOne(query);
    //   const isEmployee = user?.role === "employee";

    //   if (!isEmployee) {
    //     return res.status(403).send({ message: "forbidden access" });
    //   }
    //   next();
    // };

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

    app.get("users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.get("/normalUsers", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find({ role: "user" }).toArray();
      res.send(result);
      console.log(result);
    });

    // get pending role user
    app.get("/pendingUser/:email", verifyToken, async (req, res) => {
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
    app.patch("/addedTeam/:id", verifyToken, async (req, res) => {
      const addTeam = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateAddTeam = {
        $set: {
          role: "employee",
          adminEmail: addTeam.email,
        },
      };
      const result = usersCollection.updateOne(filter, updateAddTeam);
      res.send(result);
    });

    // all product get
    app.get("/assets", verifyToken, async (req, res) => {
      const queryObj = {};
      const name = req.query.name;
      const type = req.query.type;

      if (name) {
        queryObj.name = { $regex: new RegExp(name, "i") };
      }
      if (type) {
        queryObj.type = { $regex: new RegExp(type) };
      }
      const result = await assetCollection.find(queryObj).toArray();
      res.send(result);
    });

    // asset sort to quantity
    app.get("/limited-stock/:email", verifyToken, async (req, res) => {
      const email = req.params.email;

      const limitedStockItem = await assetCollection
        .find({ email: email, quantity: { $lt: 10 } })
        .sort({ quantity: -1 })
        .toArray();
      res.send(limitedStockItem);
    });

    // delete user
    app.delete("/user/:id",  async (req, res) => {
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

    app.get("/custom-assets/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await assetCustomRequestCollection
        .find({ email })
        .toArray();
      res.send(result);
    });

    app.get("/custom-asset/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await assetCustomRequestCollection.findOne({
        _id: new ObjectId(id),
      });
      res.send(result);
    });

    // request asset
    app.post("/request-asset", async (req, res) => {
      const asset = req.body;
      const existingAsset = await assetRequestCollection.findOne({
        name: asset.name,
        type: asset.type,
        email: asset.email,
      });

      if (existingAsset) {
        await assetRequestCollection.updateOne(
          {
            name: asset.name,
            type: asset.type,
            email: asset.email,
          },
          { $inc: { requestCount: 1 } }
        );
      } else {
        await assetRequestCollection.insertOne({
          ...asset,
          requestCount: 1,
          date: new Date(),
          status: "pending",
        });
      }

      res.send(existingAsset);
    });

    // get top most product verifyToken,
    app.get("/top-product", async (req, res) => {
      const topProducts = await assetRequestCollection
        .find({})
        .sort({ requestCount: -1 })
        .limit(4)
        .toArray();
      res.send(topProducts);
    });

    // my monthly requested
    app.get("/monthly-request/:email", async (req, res) => {
      const email = req.params.email;
      const result = await assetRequestCollection.find({ email }).toArray();
      res.send(result);
    });

    // get all request asset
    app.get(
      "/request-asset/:adminEmail",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const adminEmail = req.params.adminEmail;
        const queryObj = {
          adminEmail,
        };
        const email = req.query.email;

        if (email) {
          queryObj.email = { $regex: new RegExp(email, "i") };
        }

        const result = await assetRequestCollection.find(queryObj).toArray();
        res.send(result);
      }
    );

    // get all pending request asset
    app.get("/pending-assets/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      const query = {
        email: email,
        status: "pending",
      };
      const result = await assetRequestCollection.find(query).toArray();
      res.send(result);
    });

    // get pending request max: 5 access only admin
    app.get("/pending-products/:adminEmail", verifyToken, async (req, res) => {
      const adminEmail = req.params.adminEmail;
      const query = {
        adminEmail: adminEmail,
        status: "pending",
      };
      const result = await assetRequestCollection
        .find(query)
        .limit(5)
        .toArray();
      res.send(result);
    });

    // my requested asset
    app.get("/request-assets/:email", verifyToken, async (req, res) => {
      // const adminEmail = req.params.email;
      const email = req.params.email;
      console.log(email);
      const queryObj = {
        // adminEmail,
        email,
      };
      const name = req.query.name;
      const type = req.query.type;

      if (name) {
        queryObj.name = { $regex: new RegExp(name, "i") };
      }
      if (type) {
        queryObj.type = { $regex: new RegExp(type) };
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
    app.patch(
      "/request-asset-update/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

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
    app.post("/add-product", verifyToken, verifyAdmin, async (req, res) => {
      const asset = req.body;
      const result = await assetCollection.insertOne(asset);
      res.send(result);
    });

    // get all assets access only admin
    app.get("/assets/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      const queryObj = {
        email,
      };
      const sortObj = {};

      const name = req.query.name;
      const type = req.query.type;
      const sortField = req.query.sortField;
      const sortOrder = req.query.sortOrder;

      if (name) {
        queryObj.name = { $regex: new RegExp(name, "i") };
      }
      if (type) {
        queryObj.type = { $regex: new RegExp(type) };
      }
      if (sortField && sortOrder) {
        sortObj[sortField] = sortOrder;
      }

      const result = await assetCollection
        .find(queryObj)
        .sort(sortObj)
        .toArray();
      res.send(result);
    });

    // single asset delete
    app.delete("/asset/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await assetCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/asset/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await assetCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // all custom asset get
    app.get("/custom-asset", verifyToken, verifyAdmin, async (req, res) => {
      const result = await assetCustomRequestCollection.find().toArray();
      res.send(result);
    });

    // custom asset request reject
    app.delete(
      "/custom-asset/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await assetCustomRequestCollection.deleteOne(query);
        res.send(result);
      }
    );

    // update custom asset to approve
    app.patch(
      "/custom-asset-update/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

    // single product update
    app.patch(
      "/product-update/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
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
      }
    );

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
    app.get("/packages", verifyToken, async (req, res) => {
      const result = await packageCollection.find().toArray();
      res.send(result);
    });

    // get single package
    app.get("/singePackage/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await packageCollection.findOne(query);
      res.send(result);
      console.log(result);
    });

    // type count show to chart
    app.get(
      "/product-type-count/:adminEmail",
      verifyToken,
      async (req, res) => {
        const adminEmail = req.params.adminEmail;

        const returnableCount = await assetRequestCollection.countDocuments({
          adminEmail,
          type: "Returnable",
        });
        const nonReturnable = await assetRequestCollection.countDocuments({
          adminEmail,
          type: "Non-returnable",
        });
        res.send({ returnableCount, nonReturnable });
      }
    );

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

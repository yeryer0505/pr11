const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const path = require("path");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME || "shop";

if (!MONGO_URI) {
  console.error("MONGO_URI is missing. Set it in .env or hosting env vars.");
  process.exit(1);
}

let productsCollection;

MongoClient.connect(MONGO_URI)
  .then((client) => {
    const db = client.db(DB_NAME);
    productsCollection = db.collection("products");
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.error("Mongo error:", err);
    process.exit(1);
  });

function ensureDb(req, res) {
  if (!productsCollection) {
    res.status(503).json({ error: "Database not ready" });
    return false;
  }
  return true;
}

function parseObjectId(id, res) {
  if (!ObjectId.isValid(id)) {
    res.status(400).json({ error: "Invalid id" });
    return null;
  }
  return new ObjectId(id);
}

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.get("/api/products", async (req, res) => {
  try {
    if (!ensureDb(req, res)) return;

    const { category, minPrice, sort, fields } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (minPrice !== undefined) filter.price = { $gte: Number(minPrice) };

    const sortOption = sort === "price" ? { price: 1 } : {};

    const options = {};
    if (fields) {
      const projection = {};
      fields.split(",").map(s => s.trim()).filter(Boolean).forEach((f) => (projection[f] = 1));
      projection._id = 0;
      options.projection = projection;
    }

    const products = await productsCollection
      .find(filter, options)
      .sort(sortOption)
      .toArray();

    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    if (!ensureDb(req, res)) return;

    const oid = parseObjectId(req.params.id, res);
    if (!oid) return;

    const product = await productsCollection.findOne({ _id: oid });
    if (!product) return res.status(404).json({ error: "Not found" });

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.post("/api/products", async (req, res) => {
  try {
    if (!ensureDb(req, res)) return;

    const { name, price, category, description, image } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ error: "name and price are required" });
    }

    const doc = {
      name: String(name),
      price: Number(price),
      category: category ? String(category) : null,
      description: description ? String(description) : null,
      image: image ? String(image) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await productsCollection.insertOne(doc);

    const created = await productsCollection.findOne({ _id: result.insertedId });
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.put("/api/products/:id", async (req, res) => {
  try {
    if (!ensureDb(req, res)) return;

    const oid = parseObjectId(req.params.id, res);
    if (!oid) return;

    const allowed = ["name", "price", "category", "description", "image"];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key];
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    if (update.name !== undefined) update.name = String(update.name);
    if (update.price !== undefined) update.price = Number(update.price);
    if (update.category !== undefined) update.category = update.category === null ? null : String(update.category);
    if (update.description !== undefined) update.description = update.description === null ? null : String(update.description);
    if (update.image !== undefined) update.image = update.image === null ? null : String(update.image);

    update.updatedAt = new Date();

    const result = await productsCollection.findOneAndUpdate(
      { _id: oid },
      { $set: update },
      { returnDocument: "after" }
    );

    if (!result.value) return res.status(404).json({ error: "Not found" });
    res.json(result.value);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.delete("/api/products/:id", async (req, res) => {
  try {
    if (!ensureDb(req, res)) return;

    const oid = parseObjectId(req.params.id, res);
    if (!oid) return;

    const result = await productsCollection.deleteOne({ _id: oid });
    if (result.deletedCount === 0) return res.status(404).json({ error: "Not found" });

    res.json({ ok: true, deletedId: req.params.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.get("/version", (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  res.json({ version: "1.1", updatedAt: today });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

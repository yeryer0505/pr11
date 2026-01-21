const express = require("express");
const { MongoClient } = require("mongodb");
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

app.get("/", (req, res) => {
  res.json({ message: "API is running" });
});

app.get("/api/products", async (req, res) => {
  try {
    if (!productsCollection) {
      return res.status(503).json({ error: "Database not ready" });
    }

    const { category, minPrice, sort, fields } = req.query;

    const filter = {};
    if (category) filter.category = category;
    if (minPrice) filter.price = { $gte: Number(minPrice) };

    const sortOption = sort === "price" ? { price: 1 } : {};

    const options = {};
    if (fields) {
      const projection = {};
      fields.split(",").forEach((f) => (projection[f] = 1));
      projection._id = 0;
      options.projection = projection;
    }

    const products = await productsCollection
      .find(filter, options)
      .sort(sortOption)
      .toArray();

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

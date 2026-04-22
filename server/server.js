const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const db = require("./db");


app.use(cors());
app.use(express.json());


app.get("/api/test-db", (req, res) => {
  db.query("SELECT 1 + 1 AS result", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database query failed" });
    }
    res.json(results[0]);
  });
});


app.get("/api/users", (req, res) => {
  db.query("SELECT * FROM users", (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to fetch users" });
    }
    res.json(results);
  });
});

app.get("/api/health", (req, res) => {
  res.json({ message: "API is working" });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
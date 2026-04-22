const mysql = require("mysql2");
const config = require("./config");

const db = mysql.createConnection(config);

db.connect((err) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log("Connected to MySQL database.");
});

module.exports = db;
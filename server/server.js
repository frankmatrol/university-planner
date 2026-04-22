const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./db");
const requireAuth = require("./authMiddleware");

require("dotenv").config();

const {
  programs,
  engineeringPrograms,
  engineeringOptions,
  minors,
  termLabels,
} = require("./referenceData");

const app = express();

function isEngineeringProgram(program) {
  return engineeringPrograms.includes(program);
}

function createToken(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function parseSelectionArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function validateSelections({
  wants_option,
  wants_minor,
  normalizedOptions,
  normalizedMinors,
  program,
}) {
  if (wants_option && !isEngineeringProgram(program)) {
    return "This version currently supports Waterloo Engineering options only.";
  }

  if (wants_option && normalizedOptions.length === 0) {
    return "Choose at least one option.";
  }

  if (wants_minor && normalizedMinors.length === 0) {
    return "Choose at least one minor.";
  }

  if (normalizedOptions.length > 3) {
    return "You can choose at most 3 options.";
  }

  if (normalizedMinors.length > 3) {
    return "You can choose at most 3 minors.";
  }

  if (normalizedOptions.length + normalizedMinors.length > 4) {
    return "You can choose a combined total of at most 4 options/minors.";
  }

  const invalidOption = normalizedOptions.find(
    (option) => !engineeringOptions.includes(option)
  );
  if (invalidOption) {
    return "Please choose only valid Engineering options.";
  }

  const invalidMinor = normalizedMinors.find(
    (minor) => !minors.includes(minor)
  );
  if (invalidMinor) {
    return "Please choose only valid Waterloo minors.";
  }

  return null;
}

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/", (req, res) => {
  res.send("University Planner API is running.");
});

app.get("/api/health", (req, res) => {
  res.json({ message: "API is working" });
});

app.get("/api/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS result");
    res.json(rows[0]);
  } catch (error) {
    console.error("Database test error:", error);
    res.status(500).json({ error: "Database query failed" });
  }
});

app.get("/api/reference-data/signup", (req, res) => {
  res.json({
    programs,
    engineeringPrograms,
    engineeringOptions,
    minors,
    termLabels,
  });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      password,
      program,
      wants_option,
      wants_minor,
      desired_option,
      desired_minor,
      expected_graduation_year,
      current_term,
    } = req.body;

    const normalizedOptions = parseSelectionArray(desired_option);
    const normalizedMinors = parseSelectionArray(desired_minor);

    if (
      !first_name ||
      !last_name ||
      !email ||
      !password ||
      !program ||
      !expected_graduation_year ||
      !current_term
    ) {
      return res.status(400).json({
        error: "Please fill in all required fields.",
      });
    }

    if (!programs.includes(program)) {
      return res.status(400).json({
        error: "Please choose a valid Waterloo program.",
      });
    }

    if (!termLabels.includes(current_term)) {
      return res.status(400).json({
        error: "Please choose a valid Waterloo term label.",
      });
    }

    const selectionError = validateSelections({
      wants_option,
      wants_minor,
      normalizedOptions,
      normalizedMinors,
      program,
    });

    if (selectionError) {
      return res.status(400).json({ error: selectionError });
    }

    const [existingUsers] = await db.query(
      "SELECT user_id FROM users WHERE email = ?",
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        error: "An account with this email already exists.",
      });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await db.query(
      `
      INSERT INTO users (
        first_name,
        last_name,
        email,
        password_hash,
        program,
        wants_option,
        wants_minor,
        desired_option,
        desired_minor,
        current_term,
        expected_graduation_year
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        first_name,
        last_name,
        email,
        password_hash,
        program,
        wants_option ? 1 : 0,
        wants_minor ? 1 : 0,
        wants_option ? JSON.stringify(normalizedOptions) : null,
        wants_minor ? JSON.stringify(normalizedMinors) : null,
        current_term,
        expected_graduation_year,
      ]
    );

    const user = {
      user_id: result.insertId,
      email,
    };

    const token = createToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: "Account created successfully.",
      user: {
        user_id: result.insertId,
        first_name,
        last_name,
        email,
        program,
        wants_option: !!wants_option,
        wants_minor: !!wants_minor,
        desired_option: wants_option ? normalizedOptions : [],
        desired_minor: wants_minor ? normalizedMinors : [],
        expected_graduation_year,
        current_term,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Failed to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await db.query("SELECT * FROM users WHERE email = ?", [email]);

    if (users.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = users[0];

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = createToken(user);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      message: "Logged in successfully.",
      user: {
        user_id: user.user_id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        program: user.program,
        wants_option: !!user.wants_option,
        wants_minor: !!user.wants_minor,
        desired_option: parseSelectionArray(user.desired_option),
        desired_minor: parseSelectionArray(user.desired_minor),
        expected_graduation_year: user.expected_graduation_year,
        current_term: user.current_term,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Failed to log in." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logged out successfully." });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const [users] = await db.query(
      `
      SELECT
        user_id,
        first_name,
        last_name,
        email,
        program,
        wants_option,
        wants_minor,
        desired_option,
        desired_minor,
        expected_graduation_year,
        current_term
      FROM users
      WHERE user_id = ?
      `,
      [req.user.user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({
      ...users[0],
      wants_option: !!users[0].wants_option,
      wants_minor: !!users[0].wants_minor,
      desired_option: parseSelectionArray(users[0].desired_option),
      desired_minor: parseSelectionArray(users[0].desired_minor),
    });
  } catch (error) {
    console.error("Fetch current user error:", error);
    res.status(500).json({ error: "Failed to fetch user profile." });
  }
});

app.put("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      program,
      wants_option,
      wants_minor,
      desired_option,
      desired_minor,
      expected_graduation_year,
      current_term,
    } = req.body;

    const normalizedOptions = parseSelectionArray(desired_option);
    const normalizedMinors = parseSelectionArray(desired_minor);

    if (
      !first_name ||
      !last_name ||
      !program ||
      !expected_graduation_year ||
      !current_term
    ) {
      return res.status(400).json({
        error: "Please fill in all required profile fields.",
      });
    }

    if (!programs.includes(program)) {
      return res.status(400).json({
        error: "Please choose a valid Waterloo program.",
      });
    }

    if (!termLabels.includes(current_term)) {
      return res.status(400).json({
        error: "Please choose a valid Waterloo term label.",
      });
    }

    const selectionError = validateSelections({
      wants_option,
      wants_minor,
      normalizedOptions,
      normalizedMinors,
      program,
    });

    if (selectionError) {
      return res.status(400).json({ error: selectionError });
    }

    await db.query(
      `
      UPDATE users
      SET
        first_name = ?,
        last_name = ?,
        program = ?,
        wants_option = ?,
        wants_minor = ?,
        desired_option = ?,
        desired_minor = ?,
        expected_graduation_year = ?,
        current_term = ?
      WHERE user_id = ?
      `,
      [
        first_name,
        last_name,
        program,
        wants_option ? 1 : 0,
        wants_minor ? 1 : 0,
        wants_option ? JSON.stringify(normalizedOptions) : null,
        wants_minor ? JSON.stringify(normalizedMinors) : null,
        expected_graduation_year,
        current_term,
        req.user.user_id,
      ]
    );

    const [users] = await db.query(
      `
      SELECT
        user_id,
        first_name,
        last_name,
        email,
        program,
        wants_option,
        wants_minor,
        desired_option,
        desired_minor,
        expected_graduation_year,
        current_term
      FROM users
      WHERE user_id = ?
      `,
      [req.user.user_id]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: "User not found after update." });
    }

    res.json({
      message: "Profile updated successfully.",
      user: {
        ...users[0],
        wants_option: !!users[0].wants_option,
        wants_minor: !!users[0].wants_minor,
        desired_option: parseSelectionArray(users[0].desired_option),
        desired_minor: parseSelectionArray(users[0].desired_minor),
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
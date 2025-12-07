// server.js

require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const fetch = require("node-fetch");

const app = express();

// Config
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/arrowflix";
const JWT_SECRET = process.env.JWT_SECRET || "change_me";
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mongo
mongoose
  .connect(MONGO_URI, { autoIndex: true })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB error:", err));

// Models
const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, unique: true, lowercase: true, trim: true, required: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// Auth helpers
function signToken(user) {
  return jwt.sign({ sub: user._id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user) return res.status(401).json({ message: "Invalid token" });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid token" });
  }
}

// Routes: Auth
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });
  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).json({ message: "Email already in use" });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ name: name || "", email, passwordHash });
    return res.json({ message: "Registered", user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ message: "Email and password required" });
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });
    const token = signToken(user);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email } });
  } catch (e) {
    return res.status(500).json({ message: "Server error" });
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  const user = req.user;
  return res.json({ id: user._id, name: user.name, email: user.email });
});

// TMDB proxy endpoints
const TMDB_BASE = "https://api.themoviedb.org/3";

async function tmdb(path) {
  const url = `${TMDB_BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}&language=en-US`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("TMDB error");
  return r.json();
}

app.get("/api/movies/trending", async (req, res) => {
  try {
    const data = await tmdb("/trending/all/week");
    res.json(data);
  } catch {
    res.status(500).json({ message: "Failed to fetch trending" });
  }
});

app.get("/api/movies/top-rated", async (req, res) => {
  try {
    const data = await tmdb("/movie/top_rated");
    res.json(data);
  } catch {
    res.status(500).json({ message: "Failed to fetch top rated" });
  }
});

app.get("/api/movies/genre/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const data = await tmdb(`/discover/movie?with_genres=${id}&sort_by=popularity.desc`);
    res.json(data);
  } catch {
    res.status(500).json({ message: "Failed to fetch genre" });
  }
});

// Static frontend
app.use(express.static(path.join(__dirname)));

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Start
app.listen(PORT, () => {
  console.log(`ArrowFlix server running on http://localhost:${PORT}`);
});

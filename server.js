const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(__dirname)); // Automatically serves index.html and assets

const server = http.createServer(app);
const io = new Server(server);

// In-Memory Database Arrays
const USERS_DATABASE = [];
const POSTS_DATABASE = [];
const JWT_SECRET = process.env.JWT_SECRET || 'mega_social_platform_secret_key_987';

// Fixed Security Middleware (Extracts token properly from "Bearer TOKEN")
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access Denied: Missing Token' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid Token' });
    req.user = user;
    next();
  });
};

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Fields required' });
    if (USERS_DATABASE.find(u => u.username === username)) {
      return res.status(400).json({ error: 'Username already taken.' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: Date.now().toString(), username, password: hashedPassword };
    USERS_DATABASE.push(newUser);
    res.status(201).json({ message: 'Success' });
  } catch (err) {
    res.status(500).json({ error: 'Server error during registration' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = USERS_DATABASE.find(u => u.username === username);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }
    const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '2h' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Post Routes
app.post('/api/posts', authenticateToken, async (req, res) => {
  try {
    const newPost = {
      id: Date.now().toString(),
      author: req.user.username,
      content: req.body.content,
      imageUrl: req.body.imageUrl || "",
      createdAt: new Date()
    };
    POSTS_DATABASE.push(newPost);
    res.status(201).json(newPost);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post' });
  }
});

app.get('/api/posts', (req, res) => {
  res.json([...POSTS_DATABASE].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// Real-Time Socket.io Engine
io.on('connection', (socket) => {
  socket.on('user_typing', (data) => {
    socket.broadcast.emit('display_typing', { username: data.username });
  });

  socket.on('send_message', (data) => {
    io.emit('receive_message', {
      sender: data.sender,
      message: data.message,
      timestamp: new Date().toLocaleTimeString()
    });
  });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`🟢 App Portal Live at: http://localhost:${PORT}`));

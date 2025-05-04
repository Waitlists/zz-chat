const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'HoardedGoats19/@94';
const USERS_FILE = path.join(__dirname, 'users.json');

let chatHistory = [];
const users = new Map(); // username -> { ws, ip, isAdmin, color }
const sessions = new Map(); // sessionId -> username

// Middleware
app.use(express.static(path.join(__dirname)));
app.use(express.json());
app.use(cookieParser());

// Load users from file
function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
  const data = fs.readFileSync(USERS_FILE);
  return JSON.parse(data);
}

// Save users to file
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Helper to get user by username
function getUserByUsername(username) {
  const users = loadUsers();
  return users.find(u => u.username === username);
}

// Helper to get users by IP
function getUsersByIP(ip) {
  const users = loadUsers();
  return users.filter(u => u.ip === ip);
}

// Registration endpoint
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  if (!/^[a-zA-Z0-9_$#]{1,21}$/.test(username)) {
    return res.status(400).json({ error: 'Invalid username. Use only a-z, 0-9, _, $, # (max 21 chars).' });
  }

  const existingUser = getUserByUsername(username);
  if (existingUser) {
    return res.status(400).json({ error: 'Username already taken.' });
  }

  const usersWithIP = getUsersByIP(ip);
  if (usersWithIP.length > 0) {
    return res.status(400).json({ error: 'An account has already been registered from this IP address.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = {
    username,
    password: hashedPassword,
    ip,
    color: getRandomColor()
  };

  const users = loadUsers();
  users.push(newUser);
  saveUsers(users);

  res.status(200).json({ message: 'Registration successful. Please log in.' });
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required.' });
  }

  if (username.toLowerCase() === ADMIN_USERNAME) {
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect admin password.' });
    }
    const sessionId = uuidv4();
    sessions.set(sessionId, ADMIN_USERNAME);
    res.cookie('sessionId', sessionId, { httpOnly: true });
    return res.status(200).json({ message: 'Admin login successful.' });
  }

  const user = getUserByUsername(username);
  if (!user) {
    return res.status(400).json({ error: 'User not found.' });
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const sessionId = uuidv4();
  sessions.set(sessionId, username);
  res.cookie('sessionId', sessionId, { httpOnly: true });
  res.status(200).json({ message: 'Login successful.' });
});

// Logout endpoint
app.post('/logout', (req, res) => {
  const sessionId = req.cookies.sessionId;
  if (sessionId) {
    sessions.delete(sessionId);
    res.clearCookie('sessionId');
  }
  res.status(200).json({ message: 'Logged out successfully.' });
});

// WebSocket connection
wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionId = cookies.sessionId;
  const username = sessions.get(sessionId);

  if (!username) {
    ws.send(JSON.stringify({ type: 'error', data: 'Unauthorized. Please log in.' }));
    ws.close();
    return;
  }

  const isAdmin = username.toLowerCase() === ADMIN_USERNAME;
  const user = getUserByUsername(username);
  const color = isAdmin ? 'red' : (user ? user.color : getRandomColor());

  users.set(username, { ws, ip, isAdmin, color });

  // Send chat history
  ws.send(JSON.stringify({ type: 'history', data: chatHistory }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'chat') {
        const messageObj = {
          name: username,
          color: color,
          message: data.data
        };

        chatHistory.push(messageObj);
        broadcast({ type: 'chat', data: messageObj });
      }

      else if (data.type === 'command') {
        if (!isAdmin) {
          ws.send(JSON.stringify({ type: 'error', data: 'Unauthorized command.' }));
          return;
        }

        const [cmd, ...args] = data.data.trim().split(/\s+/);

        switch (cmd) {
          case '/clear':
            chatHistory = [];
            broadcast({ type: 'clearChat' });
            break;

          case '/who':
          case '/ip':
            const targetName = args[0];
            const targetUser = users.get(targetName);
            ws.send(JSON.stringify({
              type: 'system',
              data: targetUser ? `${targetName} IP: ${targetUser.ip}` : `User "${targetName}" not found.`
            }));
            break;

          case '/online':
            const userList = Array.from(users.entries()).map(([name, data]) => ({ name, color: data.color }));
            ws.send(JSON.stringify({ type: 'onlineList', data: userList }));
            break;

          case '/delete':
            const target = args[0];
            const kickedUser = users.get(target);
            if (kickedUser) {
              kickedUser.ws.send(JSON.stringify({ type: 'kick', data: 'You have been removed. Refresh and log in again.' }));
              kickedUser.ws.close();
              users.delete(target);
              ws.send(JSON.stringify({ type: 'system', data: `${target} was removed.` }));
            } else {
              ws.send(JSON.stringify({ type: 'system', data: `User "${target}" not found.` }));
            }
            break;

          case '/kickall':
            for (const [name, data] of users.entries()) {
              if (name.toLowerCase() !== ADMIN_USERNAME) {
                data.ws.send(JSON.stringify({
                  type: 'kick',
                  data: 'You have been removed by admin. Refresh and log in again.'
                }));
                data.ws.close();
                users.delete(name);
              }
            }
            ws.send(JSON.stringify({ type: 'system', data: 'All users have been kicked.' }));
            break;

          default:
            ws.send(JSON.stringify({ type: 'system', data: `Unknown command: ${cmd}` }));
            break;
        }
      }

    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    if (users.has(username)) {
      users.delete(username);
      console.log(`${username} disconnected`);
    }
  });
});

// Broadcast message to all connected users
function broadcast(message) {
  for (const { ws } of users.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

// Parse cookies from header
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  const cookiePairs = cookieHeader.split(';');
  for (const pair of cookiePairs) {
    const [key, value] = pair.trim().split('=');
    cookies[key] = value;
  }
  return cookies;
}

// Generate random color
function getRandomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;
}

server.listen(process.env.PORT || 3000, () => {
  console.log('Chat server running on port ' + (process.env.PORT || 3000));
});

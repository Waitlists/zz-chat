const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./database');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static('.'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'zzsecret',
  resave: false,
  saveUninitialized: true
}));

function randomColor() {
  const colors = ['#39ff14', '#00ffff', '#ff00ff', '#f5a623', '#ff4136', '#0074d9'];
  return colors[Math.floor(Math.random() * colors.length)];
}

app.get('/', (req, res) => {
  if (!req.session.username) return res.redirect('/login.html');
  res.sendFile(__dirname + '/index.html');
});

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!/^[a-z0-9_]+$/i.test(username)) return res.send('Invalid username format.');

  db.get(`SELECT * FROM users WHERE username = ? OR ip = ?`, [username, ip], async (err, row) => {
    if (row) return res.send('Username or IP already in use.');
    const hash = await bcrypt.hash(password, 10);
    const color = randomColor();

    db.run(`INSERT INTO users (username, password, ip, color) VALUES (?, ?, ?, ?)`,
      [username, hash, ip, color], (err) => {
        if (err) return res.send('Registration failed.');
        req.session.username = username;
        res.redirect('/');
      });
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (!user) return res.send('User not found.');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.send('Wrong password.');
    req.session.username = username;
    res.redirect('/');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

io.use((socket, next) => {
  let req = socket.request;
  let res = req.res;
  session(req, res, next);
});

io.on('connection', (socket) => {
  const req = socket.request;
  const session = req.session;

  if (!session.username) return;

  db.all(`SELECT * FROM messages ORDER BY timestamp ASC`, [], (err, rows) => {
    rows.forEach(msg => socket.emit('chat message', msg));
  });

  db.get(`SELECT color FROM users WHERE username = ?`, [session.username], (err, user) => {
    const userColor = user.color;

    socket.on('chat message', (msg) => {
      if (session.username === 'admin' && msg.startsWith('/clear')) {
        db.run(`DELETE FROM messages`);
        io.emit('clear chat');
      } else if (session.username === 'admin' && msg.startsWith('/delete user ')) {
        const target = msg.split(' ')[2];
        db.run(`DELETE FROM users WHERE username = ?`, [target]);
        io.emit('chat message', { username: 'admin', message: `User ${target} deleted.` });
      } else {
        db.run(`INSERT INTO messages (username, message) VALUES (?, ?)`, [session.username, msg]);
        io.emit('chat message', { username: session.username, message: msg, color: userColor });
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`zz chat server running on port ${PORT}`);
});

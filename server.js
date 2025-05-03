const express = require('express');
const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const chatFile = path.join(__dirname, 'chat.json');
let chatHistory = [];
let users = {};

// Load chat history
if (fs.existsSync(chatFile)) {
  chatHistory = JSON.parse(fs.readFileSync(chatFile, 'utf8'));
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
app.get('/client.js', (req, res) => res.sendFile(path.join(__dirname, 'client.js')));

wss.on('connection', (ws) => {
  let username = null;

  ws.send(JSON.stringify({ type: 'history', data: chatHistory }));

  ws.on('message', (message) => {
    const msg = JSON.parse(message);

    if (msg.type === 'setName') {
      if (Object.values(users).includes(msg.data)) {
        ws.send(JSON.stringify({ type: 'error', data: 'Username taken' }));
      } else {
        username = msg.data;
        users[ws] = username;
        ws.send(JSON.stringify({ type: 'nameSet', data: username }));
      }
    }

    if (msg.type === 'chat' && username) {
      const entry = {
        name: username,
        color: msg.color,
        message: msg.data,
        timestamp: Date.now()
      };
      chatHistory.push(entry);
      fs.writeFileSync(chatFile, JSON.stringify(chatHistory, null, 2));

      const outbound = JSON.stringify({ type: 'chat', data: entry });
      wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(outbound);
        }
      });
    }
  });

  ws.on('close', () => {
    delete users[ws];
  });
});

server.listen(PORT, () => console.log(`zz chat running on port ${PORT}`));

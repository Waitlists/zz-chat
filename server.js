const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const ADMIN_PASSWORD = 'HoardedGoats19/@94';

let chatHistory = [];
let lockdown = false;
const users = new Map(); // username -> { ws, ip, isAdmin, color }

app.use(express.static(path.join(__dirname)));

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let currentUsername = null;
  let userColor = null;

  ws.send(JSON.stringify({ type: 'history', data: chatHistory }));
  ws.send(JSON.stringify({ type: 'lockdown', data: lockdown }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'setName') {
        const requestedName = data.data.trim();
        const password = data.password || '';
        const validName = /^[a-zA-Z0-9_$#]{1,21}$/;

        if (!requestedName || !validName.test(requestedName)) {
          ws.send(JSON.stringify({ type: 'error', data: 'Invalid username. Use a-z, 0-9, _, $, or # (max 21 chars).' }));
          return;
        }

        if (users.has(requestedName)) {
          ws.send(JSON.stringify({ type: 'error', data: 'Username already taken.' }));
          return;
        }

        const isAdmin = requestedName.toLowerCase() === 'admin';
        if (isAdmin && password !== ADMIN_PASSWORD) {
          ws.send(JSON.stringify({ type: 'error', data: 'Incorrect admin password.' }));
          return;
        }

        currentUsername = requestedName;
        userColor = data.color || `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;

        users.set(currentUsername, { ws, ip, isAdmin, color: userColor });
        ws.send(JSON.stringify({ type: 'nameSet', data: currentUsername }));
        ws.send(JSON.stringify({ type: 'adminStatus', data: isAdmin }));
      }

      else if (data.type === 'chat') {
        if (!currentUsername) {
          ws.send(JSON.stringify({ type: 'error', data: 'Please set a username first.' }));
          return;
        }

        if (lockdown && !users.get(currentUsername).isAdmin) {
          ws.send(JSON.stringify({ type: 'error', data: 'Chat is currently locked.' }));
          return;
        }

        const messageObj = {
          name: currentUsername,
          color: userColor,
          message: data.data
        };

        chatHistory.push(messageObj);
        broadcast({ type: 'chat', data: messageObj });
      }

      else if (data.type === 'command') {
        if (!currentUsername || !users.get(currentUsername).isAdmin) {
          ws.send(JSON.stringify({ type: 'error', data: 'Unauthorized command.' }));
          return;
        }

        const [cmd, ...args] = data.data.trim().split(/\s+/);

        switch (cmd) {
          case '/clear':
            chatHistory = [];
            broadcast({ type: 'clear' });
            break;

          case '/lockdown':
            lockdown = args[0] === 'on';
            broadcast({ type: 'lockdown', data: lockdown });
            break;

          case '/who':
          case '/ip':
            const who = args[0];
            const user = users.get(who);
            if (user) {
              ws.send(JSON.stringify({ type: 'system', data: `${who} IP: ${user.ip}` }));
            } else {
              ws.send(JSON.stringify({ type: 'system', data: `User "${who}" not found.` }));
            }
            break;

          case '/online':
            const userList = [...users.entries()].map(([name, u]) => ({
              name,
              color: name.toLowerCase() === 'admin' ? 'red' : u.color
            }));
            ws.send(JSON.stringify({ type: 'onlineList', data: userList }));
            break;

          case '/delete':
            const toKick = args[0];
            const target = users.get(toKick);
            if (target) {
              target.ws.send(JSON.stringify({
                type: 'kick',
                data: 'You have been removed from the chat. Please refresh and choose a new username.'
              }));
              target.ws.close();
              users.delete(toKick);
            }
            break;

          case '/kickall':
            for (const [name, u] of users.entries()) {
              if (!u.isAdmin) {
                u.ws.send(JSON.stringify({
                  type: 'kick',
                  data: 'You have been removed from the chat. Please refresh and choose a new username.'
                }));
                u.ws.close();
                users.delete(name);
              }
            }
            break;

          default:
            ws.send(JSON.stringify({ type: 'system', data: `Unknown command: ${cmd}` }));
            break;
        }
      }

    } catch (err) {
      console.error('Error:', err);
    }
  });

  ws.on('close', () => {
    if (currentUsername) {
      users.delete(currentUsername);
    }
  });
});

function broadcast(data) {
  for (const { ws } of users.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }
}

server.listen(process.env.PORT || 3000, () => {
  console.log('zz chat running on port', process.env.PORT || 3000);
});

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const ADMIN_PASSWORD = 'HoardedGoats19/@94';

let chatHistory = [];
const users = new Map(); // username -> { ws, ip, isAdmin, color }

app.use(express.static(path.join(__dirname)));

wss.on('connection', (ws, req) => {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  let currentUsername = null;

  ws.send(JSON.stringify({ type: 'history', data: chatHistory }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'setName') {
        const requestedName = data.data.trim();
        const password = data.password || '';
        const color = data.color;

        if (!/^[a-zA-Z0-9_$#]{1,21}$/.test(requestedName)) {
          ws.send(JSON.stringify({ type: 'error', data: 'Invalid username. Use only a-z, 0-9, _, $, # (max 21 chars).' }));
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
        users.set(currentUsername, { ws, ip, isAdmin, color });

        ws.send(JSON.stringify({ type: 'nameSet', data: currentUsername }));
        ws.send(JSON.stringify({ type: 'adminStatus', data: isAdmin }));
        console.log(`${currentUsername} connected (${ip})`);
      }

      else if (data.type === 'chat') {
        if (!currentUsername) {
          ws.send(JSON.stringify({ type: 'error', data: 'Please set a username first.' }));
          return;
        }

        const messageObj = {
          name: currentUsername,
          color: data.color,
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
              kickedUser.ws.send(JSON.stringify({ type: 'kick', data: 'You have been removed. Refresh and pick a new name.' }));
              kickedUser.ws.close();
              users.delete(target);
              ws.send(JSON.stringify({ type: 'system', data: `${target} was removed.` }));
            } else {
              ws.send(JSON.stringify({ type: 'system', data: `User "${target}" not found.` }));
            }
            break;

          case '/kickall':
            for (const [name, data] of users.entries()) {
              if (name.toLowerCase() !== 'admin') {
                data.ws.send(JSON.stringify({
                  type: 'kick',
                  data: 'You have been removed by admin. Refresh and pick a new name.'
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
    if (currentUsername && users.has(currentUsername)) {
      users.delete(currentUsername);
      console.log(`${currentUsername} disconnected`);
    }
  });
});

function broadcast(message) {
  for (const { ws } of users.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

server.listen(process.env.PORT || 3000, () => {
  console.log('zz chat server running on port ' + (process.env.PORT || 3000));
});

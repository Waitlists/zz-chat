const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const ADMIN_PASSWORD = 'HoardedGoats19/@94';

let chatHistory = [];
const users = new Map(); // username -> { ws, ip, color, isAdmin }

app.use(express.static(path.join(__dirname)));

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  let currentUsername = null;

  ws.send(JSON.stringify({ type: 'history', data: chatHistory }));

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);

      if (data.type === 'setName') {
        const requestedName = data.data;
        const password = data.password || '';
        const color = data.color || '#ffffff';

        // Reject if already taken
        if (users.has(requestedName)) {
          ws.send(JSON.stringify({ type: 'error', data: 'Username already taken.' }));
          return;
        }

        // Admin authentication
        const isAdmin = requestedName.toLowerCase() === 'admin';
        if (isAdmin && password !== ADMIN_PASSWORD) {
          ws.send(JSON.stringify({ type: 'error', data: 'Incorrect admin password.' }));
          return;
        }

        // Set user
        currentUsername = requestedName;
        users.set(currentUsername, { ws, ip, color, isAdmin });

        ws.send(JSON.stringify({ type: 'nameSet', data: currentUsername }));
        ws.send(JSON.stringify({ type: 'adminStatus', data: isAdmin }));
        console.log(`${currentUsername} connected (${ip})`);
      }

      else if (data.type === 'chat') {
        if (!currentUsername) {
          ws.send(JSON.stringify({ type: 'error', data: 'Please set a username first.' }));
          return;
        }

        const user = users.get(currentUsername);
        const messageObj = {
          name: currentUsername,
          color: user.color,
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
            const targetName = args[0];
            const targetUser = users.get(targetName);
            if (targetUser) {
              ws.send(JSON.stringify({ type: 'system', data: `${targetName} IP: ${targetUser.ip}` }));
            } else {
              ws.send(JSON.stringify({ type: 'system', data: `User "${targetName}" not found.` }));
            }
            break;

          case '/online':
            const userList = [...users.entries()].map(([name, user]) => ({
              name,
              color: user.color
            }));
            ws.send(JSON.stringify({ type: 'onlineUsers', data: userList }));
            break;

          case '/delete':
            const userToKick = args[0];
            const userEntry = users.get(userToKick);
            if (userEntry) {
              userEntry.ws.send(JSON.stringify({
                type: 'kick',
                data: 'You have been removed from the chat. Please refresh and choose a new username.'
              }));
              userEntry.ws.close();
              users.delete(userToKick);
              broadcast({ type: 'system', data: `${userToKick} was removed by admin.` });
            } else {
              ws.send(JSON.stringify({ type: 'system', data: `User "${userToKick}" not found.` }));
            }
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

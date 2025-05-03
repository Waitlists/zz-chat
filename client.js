const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
let username = localStorage.getItem('username') || null;
let color = localStorage.getItem('color') || getRandomColor();
let isAdmin = false;
let pendingMessage = null;

const input = document.getElementById('input');
const sendBtn = document.getElementById('send');
const messages = document.getElementById('messages');

function attemptSend() {
  const text = input.value.trim();
  if (!text) return;

  if (!username) {
    pendingMessage = text;
    promptForUsername();
  } else {
    sendMessage(text);
  }
}

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') attemptSend();
});

sendBtn.addEventListener('click', attemptSend);

socket.addEventListener('open', () => {
  if (username) {
    socket.send(JSON.stringify({ type: 'setName', data: username, color }));
  }
});

socket.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);

  switch (msg.type) {
    case 'history':
      msg.data.forEach(drawMessage);
      break;
    case 'chat':
      drawMessage(msg.data);
      break;
    case 'system':
      drawSystemMessage(msg.data);
      break;
    case 'clearChat':
      messages.innerHTML = '';
      break;
    case 'error':
      alert(msg.data);
      pendingMessage = null;
      break;
    case 'nameSet':
      username = msg.data;
      localStorage.setItem('username', username);
      localStorage.setItem('color', color);
      if (pendingMessage) {
        sendMessage(pendingMessage);
        pendingMessage = null;
      }
      break;
    case 'adminStatus':
      isAdmin = msg.data;
      break;
    case 'kick':
      alert(msg.data);
      localStorage.removeItem('username');
      localStorage.removeItem('color');
      username = null;
      color = getRandomColor();
      break;
    case 'onlineList':
      if (isAdmin) {
        const div = document.createElement('div');
        div.classList.add('system-message');
        div.innerHTML = `<span class="username" style="color: lime; text-shadow: 0 0 5px lime;">[System]</span> <span style="color: white">Online users:</span> ` +
          msg.data.map(u => `<span class="username" style="color:${u.color}; text-shadow:0 0 5px ${u.color}">${u.name}</span>`).join(', ');
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;
      }
      break;
  }
});

function sendMessage(text) {
  if (text.startsWith('/')) {
    socket.send(JSON.stringify({ type: 'command', data: text }));
  } else {
    socket.send(JSON.stringify({ type: 'chat', data: text, color }));
  }
  input.value = '';
}

function drawMessage({ name, color, message }) {
  const div = document.createElement('div');
  const nameSpan = document.createElement('span');
  nameSpan.classList.add('username');
  nameSpan.textContent = name + ': ';
  if (name.toLowerCase() === 'admin') {
    nameSpan.style.color = 'red';
    nameSpan.style.textShadow = '0 0 5px red';
  } else {
    nameSpan.style.color = color;
    nameSpan.style.textShadow = `0 0 5px ${color}`;
  }
  div.appendChild(nameSpan);
  div.append(message);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function drawSystemMessage(message) {
  if (isAdmin) {
    const div = document.createElement('div');
    div.classList.add('system-message');
    div.innerHTML = `<span class="username" style="color: lime; text-shadow: 0 0 5px lime;">[System]</span> <span style="color: white">${message}</span>`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
}

function promptForUsername() {
  const name = prompt("Please choose a username (a-z, 0-9, _, $, #, max 21 chars):");
  if (name && name.trim()) {
    const trimmed = name.trim();
    const valid = /^[a-z0-9_$#]{1,21}$/i.test(trimmed);
    if (!valid) {
      alert("Invalid username. Use only a-z, 0-9, _, $, or # (max 21 chars).");
      return;
    }
    if (trimmed.toLowerCase() === 'admin') {
      const password = prompt("Enter admin password:");
      socket.send(JSON.stringify({ type: 'setName', data: trimmed, password, color }));
    } else {
      socket.send(JSON.stringify({ type: 'setName', data: trimmed, color }));
    }
  } else {
    alert("A valid username is required to chat.");
  }
}

function getRandomColor() {
  const existing = localStorage.getItem('color');
  if (existing) return existing;
  const color = `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;
  localStorage.setItem('color', color);
  return color;
}

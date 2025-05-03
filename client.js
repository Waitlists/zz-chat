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
  if (e.key === 'Enter') {
    attemptSend();
  }
});

sendBtn.addEventListener('click', attemptSend);

socket.addEventListener('open', () => {
  if (username) {
    socket.send(JSON.stringify({ type: 'setName', data: username }));
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
    case 'error':
      alert(msg.data);
      pendingMessage = null;
      break;
    case 'nameSet':
      username = msg.data;
      localStorage.setItem('username', username);
      localStorage.setItem('color', color);
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
    div.textContent = `[SYSTEM]: ${message}`;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }
}

function promptForUsername() {
  const name = prompt("Please choose a username to join the chat:");
  if (name && name.trim()) {
    if (name.trim().toLowerCase() === 'admin') {
      const password = prompt("Enter admin password:");
      socket.send(JSON.stringify({ type: 'setName', data: name.trim(), password }));
    } else {
      socket.send(JSON.stringify({ type: 'setName', data: name.trim() }));
    }
  } else {
    alert("A username is required to send messages.");
  }
}

function getRandomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;
}

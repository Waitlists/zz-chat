const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);

let username = localStorage.getItem('username') || null;
let color = localStorage.getItem('color') || getRandomColor();
let isAdmin = false;
let pendingMessage = null;
let isLockedDown = false;

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
      location.reload();
      break;
    case 'clear':
      messages.innerHTML = '';
      break;
    case 'lockdown':
      isLockedDown = msg.data;
      toggleInputLock(isLockedDown);
      break;
    case 'onlineList':
      msg.data.forEach(user => {
        const span = document.createElement('div');
        span.innerHTML = `<span class="username" style="color:${user.color}; text-shadow: 0 0 5px ${user.color}">${user.name}</span>`;
        messages.appendChild(span);
      });
      break;
  }
});

function toggleInputLock(lock) {
  input.disabled = lock;
  sendBtn.disabled = lock;
  input.placeholder = lock ? 'The chat is locked' : 'Type a message...';
}

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
  nameSpan.style.color = name.toLowerCase() === 'admin' ? 'red' : color;
  nameSpan.style.textShadow = `0 0 5px ${nameSpan.style.color}`;
  div.appendChild(nameSpan);
  div.append(message);
  messages.appendChild(div);
}

function drawSystemMessage(message) {
  if (isAdmin) {
    const div = document.createElement('div');
    div.classList.add('system-message');
    div.innerHTML = `<span style="color: lime">[System]</span> <span style="color: white">${message}</span>`;
    messages.appendChild(div);
  }
}

function promptForUsername() {
  const name = prompt("Please choose a username (a-z, 0-9, _, $, #):");
  if (!name || !/^[a-zA-Z0-9_$#]{1,21}$/.test(name)) {
    alert("Invalid username.");
    return;
  }

  if (name.toLowerCase() === 'admin') {
    const password = prompt("Enter admin password:");
    socket.send(JSON.stringify({ type: 'setName', data: name.trim(), password, color }));
  } else {
    socket.send(JSON.stringify({ type: 'setName', data: name.trim(), color }));
  }
}

function getRandomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;
}

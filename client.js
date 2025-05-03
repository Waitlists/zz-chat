const socket = new WebSocket(`ws://${location.host}`);
let username = null;
let color = getRandomColor();
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

socket.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);

  if (msg.type === 'history') {
    msg.data.forEach(drawMessage);
  }

  if (msg.type === 'chat') {
    drawMessage(msg.data);
  }

  if (msg.type === 'error') {
    alert(msg.data);
    pendingMessage = null;
  }

  if (msg.type === 'nameSet') {
    username = msg.data;
    if (pendingMessage) {
      sendMessage(pendingMessage);
      pendingMessage = null;
    }
  }
});

function sendMessage(text) {
  socket.send(JSON.stringify({ type: 'chat', data: text, color }));
  input.value = '';
}

function drawMessage({ name, color, message }) {
  const div = document.createElement('div');
  const nameSpan = document.createElement('span');
  nameSpan.classList.add('username');
  nameSpan.textContent = name + ': ';
  nameSpan.style.color = color;
  nameSpan.style.textShadow = `0 0 5px ${color}`;
  div.appendChild(nameSpan);
  div.append(message);
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function promptForUsername() {
  const name = prompt("Please choose a username to join the chat:");
  if (name && name.trim()) {
    socket.send(JSON.stringify({ type: 'setName', data: name.trim() }));
  } else {
    alert("A username is required to send messages.");
  }
}

function getRandomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;
}

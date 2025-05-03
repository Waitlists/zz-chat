const socket = new WebSocket(`ws://${location.host}`);
let username = null;
let color = getRandomColor();
let pendingMessage = null; // store attempted message if username not set

const input = document.getElementById('input');
const messages = document.getElementById('messages');

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && input.value.trim()) {
    if (!username) {
      pendingMessage = input.value.trim();
      promptForUsername();
    } else {
      sendMessage(input.value.trim());
    }
  }
});

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
    pendingMessage = null; // reset if name taken
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
  if (name) {
    socket.send(JSON.stringify({ type: 'setName', data: name }));
  } else {
    alert("A username is required to chat.");
  }
}

function getRandomColor() {
  return `hsl(${Math.floor(Math.random() * 360)}, 100%, 70%)`;
}

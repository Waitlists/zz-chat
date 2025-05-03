const socket = io();
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

socket.on('chat message', (msg) => {
  const item = document.createElement('div');
  item.innerHTML = `<strong style="color:${msg.color || '#00ff90'}">${msg.username}:</strong> ${msg.message}`;
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});

socket.on('clear chat', () => {
  messages.innerHTML = '';
});

form.addEventListener('submit', function (e) {
  e.preventDefault();
  if (input.value) {
    socket.emit('chat message', input.value);
    input.value = '';
  }
});

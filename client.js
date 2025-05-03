const socket = new WebSocket(
    location.protocol === 'https:' ? `wss://${location.host}` : `ws://${location.host}`
  );
  
  let username = localStorage.getItem('zz-username') || null;
  let color = localStorage.getItem('zz-color') || getRandomColor();
  let isAdmin = false;
  
  const chat = document.getElementById('chat');
  const input = document.getElementById('message-input');
  const sendBtn = document.getElementById('send-btn');
  
  // Helper
  function getRandomColor() {
    const colors = ['#f54242', '#42f554', '#4287f5', '#f5e342', '#d142f5', '#42f5e9', '#f58c42'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
  
  function appendMessage(html) {
    chat.insertAdjacentHTML('beforeend', html);
    chat.scrollTop = chat.scrollHeight;
  }
  
  function promptUsername() {
    let name = prompt("Enter a username:");
    if (!name) return;
    if (name.toLowerCase() === 'admin') {
      let pass = prompt("Enter admin password:");
      socket.send(JSON.stringify({ type: 'setName', data: name, password: pass }));
    } else {
      socket.send(JSON.stringify({ type: 'setName', data: name }));
    }
  }
  
  // Handle incoming messages
  socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
  
    switch (msg.type) {
      case 'history':
        msg.data.forEach(({ name, message, color }) => {
          const userColor = name === 'admin' ? 'red' : color;
          appendMessage(`<div><span class="username" style="color: ${userColor}">${name}</span>: ${message}</div>`);
        });
        break;
  
      case 'chat':
        const { name, message, color } = msg.data;
        const userColor = name === 'admin' ? 'red' : color;
        appendMessage(`<div><span class="username" style="color: ${userColor}">${name}</span>: ${message}</div>`);
        break;
  
      case 'system':
        if (isAdmin) {
          appendMessage(`<div class="system-message">[System] <span>${msg.data}</span></div>`);
        }
        break;
  
      case 'clearChat':
        chat.innerHTML = '';
        break;
  
      case 'error':
        alert(msg.data);
        username = null;
        localStorage.removeItem('zz-username');
        break;
  
      case 'kick':
        alert(msg.data);
        localStorage.removeItem('zz-username');
        location.reload();
        break;
  
      case 'nameSet':
        username = msg.data;
        localStorage.setItem('zz-username', username);
        localStorage.setItem('zz-color', color);
        break;
  
      case 'adminStatus':
        isAdmin = msg.data;
        break;
    }
  };
  
  // Send message
  function sendMessage() {
    if (!username) {
      promptUsername();
      return;
    }
  
    const msg = input.value.trim();
    if (!msg) return;
  
    if (msg.startsWith('/')) {
      socket.send(JSON.stringify({ type: 'command', data: msg }));
    } else {
      socket.send(JSON.stringify({ type: 'chat', data: msg, color }));
    }
  
    input.value = '';
  }
  
  // Events
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  // Prompt if username missing
  if (!username) {
    setTimeout(() => promptUsername(), 500);
  }
  
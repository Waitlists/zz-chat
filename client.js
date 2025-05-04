// client.js

let socket;
let currentUser = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const registerScreen = document.getElementById('registerScreen');
const chatScreen = document.getElementById('chatScreen');
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const logoutButton = document.getElementById('logoutButton');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const messagesContainer = document.getElementById('messages');

// Initialize application
window.addEventListener('load', () => {
  checkSession();
});

// Check if user session exists
function checkSession() {
  fetch('/session')
    .then(response => response.json())
    .then(data => {
      if (data.username) {
        currentUser = data.username;
        showChatScreen();
        initializeWebSocket();
      } else {
        showLoginScreen();
      }
    })
    .catch(error => {
      console.error('Error checking session:', error);
      showLoginScreen();
    });
}

// Show login screen
function showLoginScreen() {
  loginScreen.style.display = 'block';
  registerScreen.style.display = 'none';
  chatScreen.style.display = 'none';
}

// Show registration screen
function showRegisterScreen() {
  loginScreen.style.display = 'none';
  registerScreen.style.display = 'block';
  chatScreen.style.display = 'none';
}

// Show chat screen
function showChatScreen() {
  loginScreen.style.display = 'none';
  registerScreen.style.display = 'none';
  chatScreen.style.display = 'block';
}

// Handle login form submission
loginForm.addEventListener('submit', event => {
  event.preventDefault();
  const username = loginForm.elements['username'].value;
  const password = loginForm.elements['password'].value;

  fetch('/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Login failed');
      }
      return response.json();
    })
    .then(data => {
      currentUser = username;
      showChatScreen();
      initializeWebSocket();
    })
    .catch(error => {
      console.error('Login error:', error);
      alert('Login failed. Please check your credentials.');
    });
});

// Handle registration form submission
registerForm.addEventListener('submit', event => {
  event.preventDefault();
  const username = registerForm.elements['username'].value;
  const password = registerForm.elements['password'].value;

  fetch('/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ username, password })
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Registration failed');
      }
      return response.json();
    })
    .then(data => {
      alert('Registration successful. Please log in.');
      showLoginScreen();
    })
    .catch(error => {
      console.error('Registration error:', error);
      alert('Registration failed. Please try a different username.');
    });
});

// Handle logout
logoutButton.addEventListener('click', () => {
  fetch('/logout', {
    method: 'POST'
  })
    .then(() => {
      currentUser = null;
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
      showLoginScreen();
    })
    .catch(error => {
      console.error('Logout error:', error);
    });
});

// Initialize WebSocket connection
function initializeWebSocket() {
  socket = new WebSocket(`ws://${window.location.host}`);

  socket.addEventListener('open', () => {
    console.log('WebSocket connection established');
  });

  socket.addEventListener('message', event => {
    const data = JSON.parse(event.data);
    if (data.type === 'chat') {
      displayMessage(data.data);
    } else if (data.type === 'history') {
      data.data.forEach(message => displayMessage(message));
    } else if (data.type === 'system') {
      displaySystemMessage(data.data);
    } else if (data.type === 'error') {
      alert(`Error: ${data.data}`);
    }
  });

  socket.addEventListener('close', () => {
    console.log('WebSocket connection closed');
  });

  socket.addEventListener('error', error => {
    console.error('WebSocket error:', error);
  });
}

// Handle message form submission
messageForm.addEventListener('submit', event => {
  event.preventDefault();
  const message = messageInput.value.trim();
  if (message && socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'chat', data: message }));
    messageInput.value = '';
  } else if (socket.readyState !== WebSocket.OPEN) {
    alert('WebSocket connection is not open. Please try again later.');
  }
});

// Display chat message
function displayMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.innerHTML = `<strong style="color:${message.color}">${message.name}:</strong> ${message.message}`;
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Display system message
function displaySystemMessage(message) {
  const messageElement = document.createElement('div');
  messageElement.innerHTML = `<em>${message}</em>`;
  messagesContainer.appendChild(messageElement);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

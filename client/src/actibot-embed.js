/**
 * ActiBot Embed
 * 
 * Ce script permet d'intégrer ActiBot dans n'importe quelle page web.
 * Il crée une interface chatbot flottante qui communique avec l'API ActiBot.
 * 
 * Utilisation:
 * 1. Incluez ce script dans votre page
 * 2. Configurez l'URL du serveur ActiBot
 * 
 * <script src="https://votre-serveur.com/actibot-embed.js"></script>
 */

(function() {
  // Configuration
  const API_URL = window.ACTIBOT_API_URL || 'https://actibot.up.railway.app';

  // Styles CSS
  const styles = `
    #actibot-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }
    
    #actibot-chat-button {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background-color: #3498db;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }
    
    #actibot-chat-button:hover {
      background-color: #2980b9;
      transform: scale(1.05);
    }
    
    #actibot-chat-icon {
      width: 30px;
      height: 30px;
      fill: white;
    }
    
    #actibot-chat-window {
      position: absolute;
      bottom: 80px;
      right: 0;
      width: 350px;
      height: 500px;
      background-color: white;
      border-radius: 12px;
      box-shadow: 0 5px 25px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      transition: all 0.3s ease;
      opacity: 0;
      transform: translateY(20px) scale(0.9);
      pointer-events: none;
    }
    
    #actibot-chat-window.active {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }
    
    #actibot-chat-header {
      background-color: #3498db;
      color: white;
      padding: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    #actibot-chat-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 500;
    }
    
    #actibot-close-button {
      background: none;
      border: none;
      color: white;
      font-size: 20px;
      cursor: pointer;
      padding: 0;
      margin: 0;
    }
    
    #actibot-messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 15px;
      display: flex;
      flex-direction: column-reverse;
    }
    
    .actibot-message {
      margin-bottom: 12px;
      max-width: 80%;
      padding: 10px 15px;
      border-radius: 15px;
      line-height: 1.4;
      font-size: 14px;
      word-wrap: break-word;
    }
    
    .actibot-user-message {
      align-self: flex-end;
      background-color: #3498db;
      color: white;
      border-bottom-right-radius: 5px;
    }
    
    .actibot-bot-message {
      align-self: flex-start;
      background-color: #f1f1f1;
      color: #333;
      border-bottom-left-radius: 5px;
      font-size: 14px;
      line-height: 1.5;
    }
    
    .actibot-bot-message strong {
      font-weight: 700;
      color: #000;
    }
    
    .actibot-bot-message em {
      font-style: italic;
    }
    
    .actibot-bot-message h1, .actibot-bot-message h2, .actibot-bot-message h3 {
      margin: 8px 0;
      font-weight: 600;
    }
    
    .actibot-bot-message h1 {
      font-size: 18px;
    }
    
    .actibot-bot-message h2 {
      font-size: 16px;
    }
    
    .actibot-bot-message h3 {
      font-size: 15px;
    }
    
    .actibot-bot-message ul {
      padding-left: 20px;
      margin: 8px 0;
    }
    
    .actibot-bot-message li {
      margin-bottom: 4px;
    }
    
    .actibot-bot-message a {
      color: #3498db;
      text-decoration: underline;
    }
    
    .actibot-loading {
      display: flex;
      align-items: center;
      padding: 10px 15px;
    }
    
    .actibot-loading span {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 5px;
      background-color: #ccc;
      border-radius: 50%;
      animation: actibot-loading 1.4s infinite ease-in-out both;
    }
    
    .actibot-loading span:nth-child(1) {
      animation-delay: -0.32s;
    }
    
    .actibot-loading span:nth-child(2) {
      animation-delay: -0.16s;
    }
    
    @keyframes actibot-loading {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }
    
    #actibot-input-container {
      display: flex;
      padding: 12px;
      border-top: 1px solid #eee;
    }
    
    #actibot-message-input {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 20px;
      padding: 8px 15px;
      font-size: 14px;
      outline: none;
    }
    
    #actibot-send-button {
      background-color: #3498db;
      color: white;
      border: none;
      border-radius: 20px;
      padding: 8px 15px;
      margin-left: 8px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.2s;
    }
    
    #actibot-send-button:hover {
      background-color: #2980b9;
    }
    
    #actibot-send-button:disabled {
      background-color: #95a5a6;
      cursor: not-allowed;
    }
  `;

  // Template HTML
  const template = `
    <div id="actibot-container">
      <div id="actibot-chat-button">
        <svg id="actibot-chat-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
        </svg>
      </div>
      <div id="actibot-chat-window">
        <div id="actibot-chat-header">
          <h3>ActiBot - Assistant IA</h3>
          <button id="actibot-close-button">×</button>
        </div>
        <div id="actibot-messages-container">
          <div class="actibot-message actibot-bot-message">
            Salut ! 👋 Je suis ActiBot, ton assistant dédié aux questions de la communauté WhatsApp **Iarena Educative** et du groupe **Dialogue actif**. N'hésite pas à me poser tes questions sur l'IA, je suis là pour t'aider !
          </div>
        </div>
        <div id="actibot-input-container">
          <input type="text" id="actibot-message-input" placeholder="Tape ta question ici...">
          <button id="actibot-send-button">Envoyer</button>
        </div>
      </div>
    </div>
  `;

  // Injecter les styles et le template
  function initialize() {
    // Ajouter les styles
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);
    
    // Ajouter le template
    const container = document.createElement('div');
    container.innerHTML = template;
    document.body.appendChild(container.firstElementChild);
    
    // Initialiser les événements
    setupEventListeners();
  }

  // Configurer les écouteurs d'événements
  function setupEventListeners() {
    const chatButton = document.getElementById('actibot-chat-button');
    const chatWindow = document.getElementById('actibot-chat-window');
    const closeButton = document.getElementById('actibot-close-button');
    const messageInput = document.getElementById('actibot-message-input');
    const sendButton = document.getElementById('actibot-send-button');
    
    // Ouvrir/fermer la fenêtre de chat
    chatButton.addEventListener('click', () => {
      chatWindow.classList.toggle('active');
      if (chatWindow.classList.contains('active')) {
        messageInput.focus();
      }
    });
    
    closeButton.addEventListener('click', () => {
      chatWindow.classList.remove('active');
    });
    
    // Envoyer un message
    function sendMessage() {
      const message = messageInput.value.trim();
      if (message) {
        addMessage(message, 'user');
        messageInput.value = '';
        messageInput.disabled = true;
        sendButton.disabled = true;
        
        showLoadingIndicator();
        
        // Appel API
        fetch(`${API_URL}/api/public/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ message })
        })
        .then(response => {
          if (!response.ok) {
            throw new Error('Erreur réseau ou serveur');
          }
          return response.json();
        })
        .then(data => {
          removeLoadingIndicator();
          addMessage(data.response, 'bot');
        })
        .catch(error => {
          console.error('Erreur ActiBot:', error);
          removeLoadingIndicator();
          addMessage("Désolé, une erreur est survenue. Essaie à nouveau dans quelques instants.", 'bot');
        })
        .finally(() => {
          messageInput.disabled = false;
          sendButton.disabled = false;
          messageInput.focus();
        });
      }
    }
    
    sendButton.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  }

  // Fonction pour convertir le Markdown en HTML (version simplifiée)
  function markdownToHtml(text) {
    // Gestion du texte en gras
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Gestion du texte en italique
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Gestion des titres
    text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
    
    // Gestion des listes
    text = text.replace(/^\- (.*?)$/gm, '<li>$1</li>');
    text = text.replace(/(<li>.*?<\/li>\n?)+/g, '<ul>$&</ul>');
    
    // Gestion des liens
    text = text.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Gestion des sauts de ligne
    text = text.replace(/\n/g, '<br>');
    
    return text;
  }

  // Ajouter un message au conteneur
  function addMessage(text, sender) {
    const messagesContainer = document.getElementById('actibot-messages-container');
    const messageElement = document.createElement('div');
    messageElement.classList.add('actibot-message');
    
    if (sender === 'user') {
      messageElement.classList.add('actibot-user-message');
      messageElement.textContent = text; // Pas de markdown pour les messages utilisateur
    } else {
      messageElement.classList.add('actibot-bot-message');
      messageElement.innerHTML = markdownToHtml(text); // Conversion Markdown pour les réponses du bot
    }
    
    messagesContainer.prepend(messageElement);
  }

  // Afficher l'indicateur de chargement
  function showLoadingIndicator() {
    const messagesContainer = document.getElementById('actibot-messages-container');
    const loadingElement = document.createElement('div');
    loadingElement.classList.add('actibot-message', 'actibot-bot-message', 'actibot-loading');
    loadingElement.id = 'actibot-loading-indicator';
    
    loadingElement.innerHTML = `
      <span></span>
      <span></span>
      <span></span>
      <div style="margin-left: 10px;">Quelques secondes et Actibot va te répondre 🙂</div>
    `;
    
    messagesContainer.prepend(loadingElement);
  }

  // Supprimer l'indicateur de chargement
  function removeLoadingIndicator() {
    const loadingIndicator = document.getElementById('actibot-loading-indicator');
    if (loadingIndicator) {
      loadingIndicator.remove();
    }
  }

  // Initialiser le widget quand le DOM est chargé
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();
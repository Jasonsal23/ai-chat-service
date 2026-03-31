(function() {
  const script = document.currentScript;
  const clientId = script.getAttribute('data-client-id');
  const serverUrl = script.getAttribute('data-server') || 'http://localhost:4000';

  if (!clientId) {
    console.error('AI Chat Widget: Missing data-client-id attribute');
    return;
  }

  const sessionId = 'session-' + Math.random().toString(36).substr(2, 9);
  let isOpen = false;
  let messages = [];
  let config = null;
  let isLoading = false;

  fetch(`${serverUrl}/api/config/${clientId}`)
    .then(res => res.json())
    .then(data => {
      config = data;
      messages.push({ role: 'bot', text: config.welcomeMessage });
      createWidget();
    })
    .catch(err => console.error('AI Chat Widget: Failed to load config', err));

  function createWidget() {
    const style = document.createElement('style');
    style.textContent = `
      #ai-chat-bubble {
        position: fixed; bottom: 24px; right: 24px; width: 60px; height: 60px;
        background: ${config.brandColor}; border-radius: 50%; display: flex;
        align-items: center; justify-content: center; cursor: pointer;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3); z-index: 99999;
        transition: transform 0.2s; border: none; outline: none;
      }
      #ai-chat-bubble:hover { transform: scale(1.08); }
      #ai-chat-bubble svg { width: 28px; height: 28px; fill: white; }

      #ai-chat-window {
        position: fixed; bottom: 96px; right: 24px; width: 380px; height: 520px;
        background: #1a1a1a; border-radius: 16px; display: none; flex-direction: column;
        overflow: hidden; border: 1px solid #333; box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        z-index: 99999; font-family: Arial, sans-serif;
      }
      #ai-chat-window.open { display: flex; }

      #ai-chat-header {
        background: ${config.brandColor}; padding: 16px 20px; display: flex;
        align-items: center; justify-content: space-between;
      }
      #ai-chat-header-info { display: flex; align-items: center; gap: 12px; }
      #ai-chat-avatar {
        width: 36px; height: 36px; background: rgba(255,255,255,0.2);
        border-radius: 50%; display: flex; align-items: center;
        justify-content: center; font-size: 18px;
      }
      #ai-chat-header-text h3 { font-size: 14px; color: white; font-weight: 600; margin: 0; }
      #ai-chat-header-text p { font-size: 11px; color: rgba(255,255,255,0.7); margin: 2px 0 0; }
      #ai-chat-close {
        background: none; border: none; color: rgba(255,255,255,0.7);
        font-size: 20px; cursor: pointer; padding: 4px 8px;
      }
      #ai-chat-close:hover { color: white; }

      #ai-chat-messages {
        flex: 1; overflow-y: auto; padding: 16px; display: flex;
        flex-direction: column; gap: 12px;
      }
      #ai-chat-messages::-webkit-scrollbar { width: 4px; }
      #ai-chat-messages::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }

      .ai-msg {
        max-width: 85%; padding: 10px 14px; font-size: 13px;
        line-height: 1.5; word-wrap: break-word;
      }
      .ai-msg.bot {
        background: #2a2a2a; color: #e0e0e0; align-self: flex-start;
        border-radius: 4px 12px 12px 12px;
      }
      .ai-msg.user {
        background: ${config.brandColor}; color: white; align-self: flex-end;
        border-radius: 12px 4px 12px 12px;
      }
      .ai-msg.typing {
        background: #2a2a2a; color: #888; align-self: flex-start;
        border-radius: 4px 12px 12px 12px; font-style: italic;
      }
      .ai-msg a { color: #A78BFA; text-decoration: underline; }

      #ai-chat-input-area {
        padding: 12px; border-top: 1px solid #333; display: flex; gap: 8px;
      }
      #ai-chat-input {
        flex: 1; padding: 10px 14px; border-radius: 24px; border: 1px solid #333;
        background: #2a2a2a; color: white; font-size: 13px; outline: none;
      }
      #ai-chat-input::placeholder { color: #666; }
      #ai-chat-input:focus { border-color: ${config.brandColor}; }
      #ai-chat-send {
        padding: 10px 16px; background: ${config.brandColor}; color: white;
        border: none; border-radius: 24px; cursor: pointer; font-size: 13px; font-weight: 600;
      }
      #ai-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }

      #ai-chat-footer {
        text-align: center; padding: 6px; font-size: 10px; color: #555;
        border-top: 1px solid #2a2a2a;
      }

      @media (max-width: 480px) {
        #ai-chat-window {
          width: calc(100% - 16px); height: calc(100% - 120px);
          right: 8px; bottom: 88px; border-radius: 12px;
        }
      }
    `;
    document.head.appendChild(style);

    const bubble = document.createElement('button');
    bubble.id = 'ai-chat-bubble';
    bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
    bubble.onclick = toggleChat;
    document.body.appendChild(bubble);

    const win = document.createElement('div');
    win.id = 'ai-chat-window';
    win.innerHTML = `
      <div id="ai-chat-header">
        <div id="ai-chat-header-info">
          <div id="ai-chat-avatar">${config.logoUrl ? '<img src="' + config.logoUrl + '" style="width:32px;height:32px;border-radius:50%;object-fit:cover">' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>'}</div>
          <div id="ai-chat-header-text">
            <h3>${config.headerTitle}</h3>
            <p>${config.headerSubtitle}</p>
          </div>
        </div>
        <button id="ai-chat-close" onclick="document.getElementById('ai-chat-window').classList.remove('open')">&times;</button>
      </div>
      <div id="ai-chat-messages"></div>
      <div id="ai-chat-input-area">
        <input type="text" id="ai-chat-input" placeholder="Type a message..." />
        <button id="ai-chat-send">Send</button>
      </div>
      <div id="ai-chat-footer">Powered by ${config.name}</div>
    `;
    document.body.appendChild(win);

    renderMessages();

    document.getElementById('ai-chat-send').onclick = sendMessage;
    document.getElementById('ai-chat-input').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') sendMessage();
    });
  }

  function toggleChat() {
    const win = document.getElementById('ai-chat-window');
    isOpen = !isOpen;
    if (isOpen) {
      win.classList.add('open');
      document.getElementById('ai-chat-input').focus();
    } else {
      win.classList.remove('open');
    }
  }

  function renderMessages() {
    const container = document.getElementById('ai-chat-messages');
    container.innerHTML = '';
    messages.forEach(msg => {
      const div = document.createElement('div');
      div.className = 'ai-msg ' + msg.role;
      if (msg.role === 'bot') {
        let html = msg.text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        div.innerHTML = html;
      } else {
        div.textContent = msg.text;
      }
      container.appendChild(div);
    });
    if (isLoading) {
      const typing = document.createElement('div');
      typing.className = 'ai-msg typing';
      typing.textContent = 'Thinking...';
      container.appendChild(typing);
    }
    container.scrollTop = container.scrollHeight;
  }

  async function sendMessage() {
    const input = document.getElementById('ai-chat-input');
    const msg = input.value.trim();
    if (!msg || isLoading) return;

    messages.push({ role: 'user', text: msg });
    input.value = '';
    isLoading = true;
    renderMessages();

    try {
      const res = await fetch(`${serverUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId, clientId })
      });
      const data = await res.json();
      messages.push({ role: 'bot', text: data.reply });
    } catch {
      messages.push({ role: 'bot', text: 'Sorry, something went wrong. Please try again.' });
    }

    isLoading = false;
    renderMessages();
  }
})();
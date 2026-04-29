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
        touch-action: manipulation;
      }
      #ai-chat-bubble:hover { transform: scale(1.08); }
      #ai-chat-bubble svg { width: 28px; height: 28px; fill: white; }

      @keyframes ai-chat-shake {
        0%   { transform: rotate(0deg) scale(1); }
        15%  { transform: rotate(-15deg) scale(1.1); }
        30%  { transform: rotate(12deg) scale(1.1); }
        45%  { transform: rotate(-10deg) scale(1.1); }
        60%  { transform: rotate(8deg) scale(1.05); }
        75%  { transform: rotate(-5deg) scale(1.05); }
        90%  { transform: rotate(3deg) scale(1); }
        100% { transform: rotate(0deg) scale(1); }
      }
      #ai-chat-bubble.shake { animation: ai-chat-shake 0.6s ease; }

      #ai-chat-robot {
        position: fixed; bottom: 82px; right: 27px; width: 46px;
        z-index: 99998; pointer-events: none;
        transform: translateY(60px); opacity: 0;
        transition: transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease;
      }
      #ai-chat-robot.visible { transform: translateY(0px); opacity: 1; }
      @keyframes ai-robot-wave {
        0%   { transform: rotate(0deg); transform-origin: bottom center; }
        20%  { transform: rotate(30deg); transform-origin: bottom center; }
        40%  { transform: rotate(-10deg); transform-origin: bottom center; }
        60%  { transform: rotate(25deg); transform-origin: bottom center; }
        80%  { transform: rotate(-5deg); transform-origin: bottom center; }
        100% { transform: rotate(0deg); transform-origin: bottom center; }
      }
      #ai-chat-robot.visible #ai-robot-arm {
        animation: ai-robot-wave 0.8s ease 0.4s 2;
      }

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
        #ai-chat-window.mobile-peek {
          height: 260px;
        }
        #ai-chat-input {
          font-size: 16px;
        }
        #ai-chat-send {
          touch-action: manipulation;
        }
      }
    `;
    document.head.appendChild(style);

    const bubble = document.createElement('button');
    bubble.id = 'ai-chat-bubble';
    bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>';
    bubble.onclick = toggleChat;
    document.body.appendChild(bubble);

    const robot = document.createElement('div');
    robot.id = 'ai-chat-robot';
    robot.innerHTML = `
      <svg viewBox="0 0 46 54" fill="none" xmlns="http://www.w3.org/2000/svg">
        <!-- antenna -->
        <line x1="23" y1="0" x2="23" y2="7" stroke="${config.brandColor}" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="23" cy="4" r="3" fill="${config.brandColor}"/>
        <!-- head -->
        <rect x="8" y="7" width="30" height="22" rx="6" fill="${config.brandColor}"/>
        <!-- eyes -->
        <circle cx="17" cy="17" r="3.5" fill="white"/>
        <circle cx="29" cy="17" r="3.5" fill="white"/>
        <circle cx="18" cy="17" r="1.5" fill="#111"/>
        <circle cx="30" cy="17" r="1.5" fill="#111"/>
        <!-- mouth -->
        <rect x="16" y="24" width="14" height="3" rx="1.5" fill="rgba(255,255,255,0.4)"/>
        <!-- body -->
        <rect x="11" y="31" width="24" height="18" rx="5" fill="${config.brandColor}"/>
        <!-- chest light -->
        <circle cx="23" cy="40" r="4" fill="rgba(255,255,255,0.3)"/>
        <!-- waving arm -->
        <g id="ai-robot-arm">
          <rect x="35" y="31" width="8" height="4" rx="2" fill="${config.brandColor}"/>
          <rect x="40" y="27" width="4" height="8" rx="2" fill="${config.brandColor}"/>
        </g>
        <!-- other arm -->
        <rect x="3" y="31" width="8" height="4" rx="2" fill="${config.brandColor}"/>
        <!-- legs -->
        <rect x="14" y="49" width="6" height="5" rx="2" fill="${config.brandColor}"/>
        <rect x="26" y="49" width="6" height="5" rx="2" fill="${config.brandColor}"/>
      </svg>
    `;
    document.body.appendChild(robot);

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
        <button id="ai-chat-close" onclick="toggleAiChat()">&times;</button>
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

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportResize);
      window.visualViewport.addEventListener('scroll', handleViewportResize);
    }
    function shakeBubble() {
      if (isOpen) return;
      const bubble = document.getElementById('ai-chat-bubble');
      bubble.classList.add('shake');
      bubble.addEventListener('animationend', function() {
        bubble.classList.remove('shake');
      }, { once: true });
    }

    function showRobot() {
      if (isOpen) return;
      const robot = document.getElementById('ai-chat-robot');
      robot.classList.add('visible');
      setTimeout(function() {
        robot.classList.remove('visible');
      }, 3500);
    }

    // Shake at 5s, then every 30s show the robot
    setTimeout(function() {
      shakeBubble();
      setInterval(function() {
        if (!isOpen) showRobot();
      }, 30000);
    }, 5000);
  }

  window.toggleAiChat = function() { toggleChat('close'); };

  function handleViewportResize() {
    if (!isOpen || window.innerWidth > 480) return;
    const vv = window.visualViewport;
    const win = document.getElementById('ai-chat-window');
    if (!vv || !win) return;
    const keyboardHeight = window.innerHeight - vv.offsetTop - vv.height;
    if (keyboardHeight > 50) {
      win.style.bottom = (keyboardHeight + 8) + 'px';
      win.style.maxHeight = (vv.height - 16) + 'px';
    } else {
      win.style.bottom = '';
      win.style.maxHeight = '';
    }
  }

  function toggleChat(mode) {
    const win = document.getElementById('ai-chat-window');
    if (mode !== 'close' && isOpen && win.classList.contains('mobile-peek')) {
      win.classList.remove('mobile-peek');
      document.getElementById('ai-chat-input').focus();
      return;
    }
    isOpen = !isOpen;
    if (isOpen) {
      const robot = document.getElementById('ai-chat-robot');
      if (robot) robot.classList.remove('visible');
      win.classList.add('open');
      if (mode === 'peek') {
        win.classList.add('mobile-peek');
      } else {
        win.classList.remove('mobile-peek');
      }
      document.getElementById('ai-chat-input').focus();
    } else {
      win.classList.remove('open');
      win.classList.remove('mobile-peek');
      win.style.bottom = '';
      win.style.maxHeight = '';
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

  function checkSoldOut(variantLabel) {
    // Check style dropdown (hats + cards) — option disabled or text contains "— Sold Out"
    if (variantLabel) {
      const selects = document.querySelectorAll('select');
      for (const select of selects) {
        for (const option of select.options) {
          const optionText = option.text.replace(' \u2014 Sold Out', '').trim();
          if (optionText === variantLabel) {
            if (option.disabled || option.text.includes('Sold Out')) {
              return 'That style is sold out right now. Pick a different one and I got you.';
            }
          }
        }
      }

      // Check size buttons on detail page — button text matches size and has disabled attribute
      const sizeButtons = document.querySelectorAll('button[disabled]');
      for (const btn of sizeButtons) {
        if (btn.textContent.trim() === variantLabel) {
          return 'That size is sold out. Want to try a different size?';
        }
      }
    }

    // Check Add to Cart button — if disabled or says SOLD OUT, whole product is out of stock
    const allButtons = document.querySelectorAll('button');
    for (const btn of allButtons) {
      const text = btn.textContent.trim().toUpperCase();
      if ((text === 'SOLD OUT' || text === 'ADD TO CART') && btn.disabled && text === 'SOLD OUT') {
        return "That product is sold out. Hit up g.erabrand21@gmail.com to get notified when it's back.";
      }
    }

    return null;
  }

  async function sendMessage() {
    const input = document.getElementById('ai-chat-input');
    const msg = input.value.trim();
    if (!msg || isLoading) return;

    messages.push({ role: 'user', text: msg });
    input.value = '';
    isLoading = true;
    const win = document.getElementById('ai-chat-window');
    if (win && win.classList.contains('mobile-peek')) {
      win.classList.remove('mobile-peek');
    }
    renderMessages();

    try {
      const res = await fetch(`${serverUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId, clientId })
      });
      const data = await res.json();
      const cartActions = data.cartActions || (data.cartAction ? [data.cartAction] : []);
      const soldOutMessages = [];
      const validActions = [];
      cartActions.forEach(action => {
        const soldOut = checkSoldOut(action.variantLabel);
        if (soldOut) {
          soldOutMessages.push({ message: soldOut, variantLabel: action.variantLabel });
        } else {
          validActions.push(action);
        }
      });

      if (soldOutMessages.length === 0) {
        messages.push({ role: 'bot', text: data.reply });
        validActions.forEach(action => window.postMessage(action, '*'));
      } else {
        // Show sold-out message to user instead of Claude's reply
        soldOutMessages.forEach(item => messages.push({ role: 'bot', text: item.message }));
        validActions.forEach(action => window.postMessage(action, '*'));
        // Silently notify Claude's session so it knows the item was sold out
        const soldOutSummary = soldOutMessages.map(item => `"${item.variantLabel}" is sold out on the page and was not added to cart.`).join(' ');
        fetch(`${serverUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: `[Cart update: ${soldOutSummary} Do not tell the customer it was added — it was not.]`, sessionId, clientId, silent: true })
        }).catch(() => {});
      }
    } catch {
      messages.push({ role: 'bot', text: 'Sorry, something went wrong. Please try again.' });
    }

    isLoading = false;
    renderMessages();
  }

  // Listen for add-to-cart confirmations from the parent site
  window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'GERA_ADD_TO_CART_RESULT') {
      if (event.data.success) {
        messages.push({ role: 'bot', text: 'Added to your cart! Ready to keep shopping or wanna check out?' });
      } else {
        messages.push({ role: 'bot', text: 'Couldn\'t add that to cart — ' + event.data.error + '. Try again or hit us at g.erabrand21@gmail.com' });
      }
      renderMessages();
    }
  });
})();
(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────
  const config = window.STUDY_COACH_CONFIG || {};
  const userId = config.userId || 'anonymous';
  const wsUrl = config.serverUrl || 'ws://localhost:8000/ws/chat';
  const httpUrl = wsUrl.replace(/^ws/, 'http').replace(/\/ws\/chat$/, '/chat/agentic');
  const onAction = config.onAction || null; // callback for agentic actions

  // ─── State ─────────────────────────────────────────────
  let ws = null;
  let isOpen = false;
  let isConnected = false;
  let isStreaming = false;
  let history = [];
  let currentAssistantMsg = '';
  let currentAssistantEl = null;
  let reconnectAttempts = 0;
  let reconnectTimer = null;
  let hasUnread = false;
  const MAX_RECONNECT_DELAY = 30000;

  // ─── Inject CSS ────────────────────────────────────────
  function injectCSS() {
    const scriptTag = document.querySelector('script[src*="widget.js"]');
    let cssUrl = 'widget.css';
    if (scriptTag) {
      const src = scriptTag.getAttribute('src');
      cssUrl = src.replace('widget.js', 'widget.css');
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = cssUrl;
    document.head.appendChild(link);
  }

  // ─── Lightweight Markdown ──────────────────────────────
  function renderMarkdown(text) {
    let html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Unordered lists
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

    // Paragraphs – wrap remaining loose lines
    html = html
      .split('\n\n')
      .map(block => {
        block = block.trim();
        if (!block) return '';
        if (/^<(h[1-3]|ul|ol|li)/.test(block)) return block;
        return '<p>' + block.replace(/\n/g, '<br>') + '</p>';
      })
      .join('');

    return html;
  }

  // ─── DOM Creation ──────────────────────────────────────
  function createWidget() {
    // Chat bubble
    const bubble = document.createElement('button');
    bubble.className = 'sc-bubble sc-bubble-pulse';
    bubble.id = 'sc-bubble';
    bubble.setAttribute('aria-label', 'Open AI Study Coach chat');
    bubble.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
      </svg>
    `;

    const badge = document.createElement('span');
    badge.className = 'sc-badge';
    badge.id = 'sc-badge';
    bubble.appendChild(badge);

    // Panel
    const panel = document.createElement('div');
    panel.className = 'sc-panel';
    panel.id = 'sc-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'sc-header';
    header.innerHTML = `
      <div class="sc-header-left">
        <span class="sc-status-dot" id="sc-status-dot"></span>
        <h2 class="sc-header-title">AI Study Coach</h2>
      </div>
      <button class="sc-close-btn" id="sc-close-btn" aria-label="Close chat">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    // Messages area
    const messages = document.createElement('div');
    messages.className = 'sc-messages';
    messages.id = 'sc-messages';

    // Welcome message
    const welcome = document.createElement('div');
    welcome.className = 'sc-welcome';
    welcome.id = 'sc-welcome';
    welcome.innerHTML = `
      <div class="sc-welcome-icon">🎓</div>
      <h3>Hi there!</h3>
      <p>I'm your AI Study Coach. Ask me anything about your studies, quiz results, or what to review next.</p>
    `;
    messages.appendChild(welcome);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'sc-input-area';
    inputArea.innerHTML = `
      <textarea class="sc-input" id="sc-input" placeholder="Ask a question…" rows="1" disabled></textarea>
      <button class="sc-send-btn" id="sc-send-btn" aria-label="Send message" disabled>
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    `;

    panel.appendChild(header);
    panel.appendChild(messages);
    panel.appendChild(inputArea);

    document.body.appendChild(bubble);
    document.body.appendChild(panel);

    // Cache DOM refs
    return {
      bubble,
      badge,
      panel,
      header,
      messages,
      welcome,
      input: panel.querySelector('#sc-input'),
      sendBtn: panel.querySelector('#sc-send-btn'),
      closeBtn: panel.querySelector('#sc-close-btn'),
      statusDot: panel.querySelector('#sc-status-dot'),
    };
  }

  // ─── DOM Refs ──────────────────────────────────────────
  let dom;

  // ─── WebSocket ─────────────────────────────────────────
  function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      console.error('[StudyCoach] WS connect error:', e);
      setConnected(false);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      console.log('[StudyCoach] WS connected');
      setConnected(true);
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
      } catch (e) {
        console.error('[StudyCoach] Parse error:', e);
      }
    };

    ws.onerror = (err) => {
      console.error('[StudyCoach] WS error:', err);
    };

    ws.onclose = () => {
      console.log('[StudyCoach] WS closed');
      setConnected(false);
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    if (reconnectTimer) return;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    reconnectAttempts++;
    console.log(`[StudyCoach] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function setConnected(connected) {
    isConnected = connected;
    if (dom) {
      dom.statusDot.classList.toggle('sc-connected', connected);
      dom.input.disabled = !connected || isStreaming;
      dom.sendBtn.disabled = !connected || isStreaming;
      if (connected) {
        dom.input.placeholder = 'Ask a question…';
      } else {
        dom.input.placeholder = 'Reconnecting…';
      }
    }
  }

  // ─── Message Handling ──────────────────────────────────
  function handleServerMessage(data) {
    switch (data.type) {
      case 'token':
        handleToken(data.content);
        break;
      case 'action':
        handleAction(data);
        break;
      case 'done':
        handleDone(data.weaknesses);
        break;
      case 'error':
        handleError(data.content);
        break;
      default:
        console.warn('[StudyCoach] Unknown message type:', data.type);
    }
  }

  function handleToken(content) {
    // Hide welcome on first interaction
    if (dom.welcome && dom.welcome.parentNode) {
      dom.welcome.remove();
    }

    if (!isStreaming) {
      isStreaming = true;
      dom.input.disabled = true;
      dom.sendBtn.disabled = true;
      currentAssistantMsg = '';
      currentAssistantEl = appendMessage('assistant', '');
      removeTypingIndicator();
    }
    currentAssistantMsg += content;
    const bubble = currentAssistantEl.querySelector('.sc-msg-bubble');
    bubble.innerHTML = renderMarkdown(currentAssistantMsg);
    scrollToBottom();
  }

  function handleDone(weaknesses) {
    if (currentAssistantMsg) {
      history.push({ role: 'assistant', content: currentAssistantMsg });
    }
    removeTypingIndicator();
    isStreaming = false;
    currentAssistantMsg = '';
    currentAssistantEl = null;
    dom.input.disabled = !isConnected;
    dom.sendBtn.disabled = !isConnected;
    dom.input.focus();

    // Show unread badge if panel is closed
    if (!isOpen && !hasUnread) {
      hasUnread = true;
      dom.badge.classList.add('sc-visible');
    }

    scrollToBottom();
  }

  function handleAction(data) {
    // Show action confirmation in chat
    const actionEl = document.createElement('div');
    actionEl.className = 'sc-msg sc-msg-action';
    actionEl.innerHTML = `
      <div class="sc-action-pill">
        <span class="sc-action-icon">⚡</span>
        <span class="sc-action-label">${escapeHtml(data.label || data.action)}</span>
      </div>
    `;
    dom.messages.appendChild(actionEl);
    scrollToBottom();

    // Dispatch to host page
    if (onAction) {
      try {
        onAction({
          action: data.action,
          params: data.params || {},
          label: data.label || '',
        });
        console.log('[StudyCoach] Action dispatched:', data.action, data.params);
      } catch (e) {
        console.error('[StudyCoach] onAction callback error:', e);
      }
    } else {
      console.warn('[StudyCoach] No onAction handler registered for:', data.action);
    }
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function handleError(content) {
    removeTypingIndicator();
    isStreaming = false;
    currentAssistantMsg = '';
    currentAssistantEl = null;
    dom.input.disabled = !isConnected;
    dom.sendBtn.disabled = !isConnected;

    appendMessage('error', content);
    scrollToBottom();
  }

  // ─── Send Message ──────────────────────────────────────
  function sendMessage(text) {
    text = text.trim();
    if (!text) return;
    if (!isConnected || isStreaming) return;

    // Hide welcome on first interaction
    if (dom.welcome && dom.welcome.parentNode) {
      dom.welcome.remove();
    }

    // Append user message to UI
    appendMessage('user', text);
    history.push({ role: 'user', content: text });

    // Show typing indicator
    showTypingIndicator();

    // Send via WS
    const payload = {
      user_id: userId,
      message: text,
      history: history.slice(0, -1), // send history without the current message
    };

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    } else {
      // HTTP fallback
      httpFallback(payload);
    }

    scrollToBottom();
  }

  async function httpFallback(payload) {
    try {
      const resp = await fetch(httpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      removeTypingIndicator();

      // Handle actions from HTTP response
      if (data.actions && Array.isArray(data.actions)) {
        for (const action of data.actions) {
          handleAction({
            action: action.action,
            params: action.params || {},
            label: action.label || action.action,
          });
        }
      }

      if (data.content) {
        const el = appendMessage('assistant', '');
        const bubble = el.querySelector('.sc-msg-bubble');
        bubble.innerHTML = renderMarkdown(data.content);
        history.push({ role: 'assistant', content: data.content });
      }
    } catch (e) {
      removeTypingIndicator();
      appendMessage('error', 'Failed to reach the server. Please try again.');
    }
    scrollToBottom();
  }

  // ─── UI Helpers ────────────────────────────────────────
  function appendMessage(role, content) {
    const row = document.createElement('div');
    row.className = 'sc-msg sc-msg-' + role;

    const bubble = document.createElement('div');
    bubble.className = 'sc-msg-bubble';

    if (role === 'error') {
      bubble.textContent = content;
    } else if (content) {
      bubble.innerHTML = renderMarkdown(content);
    }

    row.appendChild(bubble);
    dom.messages.appendChild(row);
    scrollToBottom();
    return row;
  }

  function showTypingIndicator() {
    if (document.getElementById('sc-typing')) return;
    const typing = document.createElement('div');
    typing.className = 'sc-msg sc-msg-assistant';
    typing.id = 'sc-typing';
    typing.innerHTML = `
      <div class="sc-typing">
        <span class="sc-typing-dot"></span>
        <span class="sc-typing-dot"></span>
        <span class="sc-typing-dot"></span>
      </div>
    `;
    dom.messages.appendChild(typing);
    scrollToBottom();
  }

  function removeTypingIndicator() {
    const el = document.getElementById('sc-typing');
    if (el) el.remove();
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      dom.messages.scrollTop = dom.messages.scrollHeight;
    });
  }

  // ─── Auto-resize textarea ─────────────────────────────
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
  }

  // ─── Toggle Panel ─────────────────────────────────────
  function togglePanel() {
    isOpen = !isOpen;
    dom.panel.classList.toggle('sc-open', isOpen);

    if (isOpen) {
      // Connect on first open
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        connect();
      }
      // Clear unread
      hasUnread = false;
      dom.badge.classList.remove('sc-visible');
      // Focus input
      setTimeout(() => dom.input.focus(), 350);
    }
  }

  // ─── Event Binding ─────────────────────────────────────
  function bindEvents() {
    dom.bubble.addEventListener('click', togglePanel);
    dom.closeBtn.addEventListener('click', togglePanel);

    dom.sendBtn.addEventListener('click', () => {
      sendMessage(dom.input.value);
      dom.input.value = '';
      autoResize(dom.input);
    });

    dom.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(dom.input.value);
        dom.input.value = '';
        autoResize(dom.input);
      }
    });

    dom.input.addEventListener('input', () => autoResize(dom.input));

    // Remove pulse class after animation
    dom.bubble.addEventListener('animationend', (e) => {
      if (e.animationName === 'sc-pulse') {
        dom.bubble.classList.remove('sc-bubble-pulse');
      }
    });
  }

  // ─── Init ──────────────────────────────────────────────
  function init() {
    injectCSS();
    dom = createWidget();
    bindEvents();
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

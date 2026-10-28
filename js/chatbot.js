/**
 * Deccan Imperia — AI Concierge Luxury Floating Chatbot
 * Automatically injects UI, handles Gemini API proxy, quick prompts, & feedback.
 */

(function () {
  'use strict';

  // Prevent multiple initializations
  if (window.DeccanImperiaChatbot) return;

  const STORAGE_KEY_HISTORY = 'imperia_chat_history';
  const STORAGE_KEY_OPEN = 'imperia_chat_is_open';
  const STORAGE_KEY_GREETED = 'imperia_chat_greeted';

  const DEFAULT_SUGGESTIONS = [
    '🏡 Schedule a Sample Home Walkthrough',
    '📐 30 × 50 Plot & 3 BHK Specifications',
    '📋 Phase 1 Availability & Plots',
    '📍 Exact Location & Directions',
    '📞 Talk to Site Engineer'
  ];

  class ImperiaChatbot {
    constructor() {
      this.history = this.loadHistory();
      this.isOpen = false;
      this.isTyping = false;
      this.initUI();
      this.attachEvents();
      this.initGreetingTimer();
      this.renderStoredMessages();
    }

    loadHistory() {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY_HISTORY);
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    }

    saveHistory() {
      try {
        sessionStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(this.history));
      } catch (e) {}
    }

    getInitialCardHtml() {
      return `
        <div class="imperia-chat-msg bot">
          <div class="imperia-chat-bubble">
            <p><strong>Namaste &amp; Welcome to Deccan Imperia.</strong></p>
            <p>I am your private digital concierge for our independent G+1 row bungalows on <strong>30 × 50 ft plots</strong> in Pandharpur, crafted by Tathe Deshmukh Builder &amp; Developer.</p>
            <p>The completed sample bungalow is open for walkthroughs today. How may I assist you?</p>
          </div>
          <div class="imperia-chat-suggested-wrap" id="imperiaInitialSuggestions">
            <div class="imperia-chat-suggested-label">Popular Topics</div>
            <div class="imperia-chat-suggested-list">
              ${DEFAULT_SUGGESTIONS.map(s => `<button class="imperia-chat-suggested-btn" data-query="${s}">${s}</button>`).join('')}
            </div>
          </div>
        </div>
      `;
    }

    initUI() {
      // 1. Create Floating Trigger & Bubble
      const triggerWrap = document.createElement('div');
      triggerWrap.className = 'imperia-chat-trigger-wrap';
      triggerWrap.id = 'imperiaChatTriggerWrap';
      triggerWrap.innerHTML = `
        <div class="imperia-chat-greeting-bubble" id="imperiaGreetingBubble">
          <button class="imperia-chat-greeting-close" id="imperiaGreetingClose" aria-label="Dismiss greeting">×</button>
          <strong>Deccan Imperia AI</strong>
          Welcome! Looking to explore our 30×50 sample bungalow or check Phase 1 availability? Ask me anytime.
        </div>
        <button class="imperia-chat-trigger-btn" id="imperiaChatTrigger" aria-label="Open AI Concierge Chat">
          <div class="imperia-chat-icon-box">
            <svg viewBox="0 0 24 24">
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <span class="imperia-chat-pulse-dot"></span>
          </div>
          <div class="imperia-chat-trigger-labels">
            <span class="imperia-chat-trigger-title">Ask Imperia AI</span>
            <span class="imperia-chat-trigger-sub">Sample Home &amp; Visits</span>
          </div>
        </button>
      `;

      // 2. Create Chat Drawer Window
      const windowWrap = document.createElement('div');
      windowWrap.className = 'imperia-chat-window';
      windowWrap.id = 'imperiaChatWindow';
      windowWrap.setAttribute('role', 'dialog');
      windowWrap.setAttribute('aria-label', 'Deccan Imperia AI Concierge');
      windowWrap.setAttribute('data-lenis-prevent', 'true');
      windowWrap.setAttribute('data-lenis-prevent-wheel', 'true');
      windowWrap.setAttribute('data-lenis-prevent-touch', 'true');
      windowWrap.innerHTML = `
        <div class="imperia-chat-header">
          <div class="imperia-chat-header-brand">
            <div class="imperia-chat-avatar">
              <img src="assets/brand/tathe-deshmukh-logo.png" alt="Tathe Deshmukh Logo" onerror="this.style.display='none'">
            </div>
            <div class="imperia-chat-header-info">
              <h4>Imperia Concierge</h4>
              <div class="imperia-chat-header-status">Online · Grounded AI</div>
            </div>
          </div>
          <div class="imperia-chat-header-tools">
            <button class="imperia-chat-tool-btn" id="imperiaChatReset" title="Restart Conversation">↺</button>
            <button class="imperia-chat-tool-btn" id="imperiaChatClose" title="Close Chat">✕</button>
          </div>
        </div>

        <div class="imperia-chat-messages" id="imperiaChatMessages" data-lenis-prevent="true" data-lenis-prevent-wheel="true" data-lenis-prevent-touch="true">
          ${this.getInitialCardHtml()}
        </div>

        <div class="imperia-chat-footer">
          <form class="imperia-chat-input-row" id="imperiaChatForm">
            <input 
              type="text" 
              class="imperia-chat-input" 
              id="imperiaChatInput" 
              placeholder="Ask about sample visits, 30x50 specs, floor plans..." 
              autocomplete="off"
              maxlength="300"
            />
            <button type="submit" class="imperia-chat-send-btn" id="imperiaChatSend" aria-label="Send message">
              <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </form>
          <div class="imperia-chat-disclaimer">
            Official Deccan Imperia AI · Direct site line: <a href="tel:+919970353935" style="color:inherit;text-decoration:underline">+91 99703 53935</a>
          </div>
        </div>
      `;

      document.body.appendChild(triggerWrap);
      document.body.appendChild(windowWrap);

      this.dom = {
        triggerWrap,
        triggerBtn: document.getElementById('imperiaChatTrigger'),
        greetingBubble: document.getElementById('imperiaGreetingBubble'),
        greetingClose: document.getElementById('imperiaGreetingClose'),
        window: windowWrap,
        closeBtn: document.getElementById('imperiaChatClose'),
        resetBtn: document.getElementById('imperiaChatReset'),
        messages: document.getElementById('imperiaChatMessages'),
        form: document.getElementById('imperiaChatForm'),
        input: document.getElementById('imperiaChatInput'),
        sendBtn: document.getElementById('imperiaChatSend'),
        initialSuggestions: document.getElementById('imperiaInitialSuggestions')
      };
    }

    attachEvents() {
      this.dom.triggerBtn.addEventListener('click', () => this.toggleChat());
      this.dom.closeBtn.addEventListener('click', () => this.closeChat());
      this.dom.resetBtn.addEventListener('click', () => this.resetConversation());

      this.dom.greetingClose.addEventListener('click', (e) => {
        e.stopPropagation();
        this.hideGreeting();
      });

      this.dom.form.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = this.dom.input.value.trim();
        if (text && !this.isTyping) {
          this.handleUserSubmit(text);
        }
      });

      // Delegate clicks on suggestion buttons & feedback buttons
      this.dom.messages.addEventListener('click', (e) => {
        const suggestBtn = e.target.closest('.imperia-chat-suggested-btn');
        if (suggestBtn) {
          const query = suggestBtn.dataset.query;
          this.handleUserSubmit(query);
          return;
        }

        const feedbackBtn = e.target.closest('.imperia-chat-feedback-btn');
        if (feedbackBtn && !feedbackBtn.classList.contains('rated')) {
          this.handleFeedback(feedbackBtn);
        }
      });

      // Master Wheel Handler: guarantees responsive, natural mouse wheel scrolling anywhere over the chat window
      const handleChatWheel = (e) => {
        e.stopPropagation();

        const messagesEl = this.dom.messages;
        if (!messagesEl) return;

        // Calculate delta based on deltaMode (0: pixels, 1: lines, 2: pages)
        let delta = e.deltaY;
        if (e.deltaMode === 1) {
          // Standard Windows notched wheel: deltaY is ~3 or ~1, multiply by line height
          delta *= 40;
        } else if (e.deltaMode === 2) {
          delta *= messagesEl.clientHeight;
        }

        const maxScroll = messagesEl.scrollHeight - messagesEl.clientHeight;
        if (maxScroll <= 0) {
          if (e.cancelable) e.preventDefault();
          return;
        }

        if (e.cancelable) {
          e.preventDefault();
        }

        const targetScroll = Math.max(0, Math.min(maxScroll, messagesEl.scrollTop + delta));
        messagesEl.scrollTop = targetScroll;
      };

      this.dom.window.addEventListener('wheel', handleChatWheel, { passive: false });

      // Touch events inside chat: allow native finger scrolling while stopping Lenis page scrolling
      this.dom.window.addEventListener('touchmove', (e) => {
        e.stopPropagation();
      }, { passive: true });

      // Escape key to close
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.closeChat();
        }
      });
    }

    initGreetingTimer() {
      const alreadyGreeted = sessionStorage.getItem(STORAGE_KEY_GREETED);
      if (!alreadyGreeted) {
        setTimeout(() => {
          if (!this.isOpen && this.dom.greetingBubble) {
            this.dom.greetingBubble.classList.add('is-visible');
            sessionStorage.setItem(STORAGE_KEY_GREETED, 'true');
          }
        }, 5000); // 5 seconds as requested by user
      }
    }

    hideGreeting() {
      if (this.dom.greetingBubble) {
        this.dom.greetingBubble.classList.remove('is-visible');
        sessionStorage.setItem(STORAGE_KEY_GREETED, 'true');
      }
    }

    toggleChat() {
      if (this.isOpen) {
        this.closeChat();
      } else {
        this.openChat();
      }
    }

    openChat() {
      this.isOpen = true;
      this.hideGreeting();
      this.dom.window.classList.add('is-open');
      this.dom.triggerBtn.style.display = 'none';
      setTimeout(() => {
        this.dom.input.focus();
        this.scrollToBottom();
      }, 150);
    }

    closeChat() {
      this.isOpen = false;
      this.dom.window.classList.remove('is-open');
      this.dom.triggerBtn.style.display = 'inline-flex';
    }

    resetConversation() {
      // 1. Tactile spin animation feedback on the button
      if (this.dom.resetBtn) {
        this.dom.resetBtn.classList.remove('spinning');
        void this.dom.resetBtn.offsetWidth; // trigger reflow
        this.dom.resetBtn.classList.add('spinning');
      }

      // 2. Clear conversation memory & storage
      this.history = [];
      this.saveHistory();

      // 3. Reset DOM to fresh initial welcome card & restore suggestion buttons
      this.dom.messages.innerHTML = this.getInitialCardHtml();
      this.dom.initialSuggestions = document.getElementById('imperiaInitialSuggestions');

      // 4. Reset scroll & input
      this.dom.messages.scrollTop = 0;
      this.dom.input.value = '';
      this.dom.input.focus();
    }

    renderStoredMessages() {
      if (!this.history || this.history.length === 0) return;

      // Hide initial suggestions if chat has ongoing history
      if (this.dom.initialSuggestions) {
        this.dom.initialSuggestions.style.display = 'none';
      }

      this.history.forEach(item => {
        if (item.role === 'user') {
          this.appendUserMessage(item.text, false);
        } else if (item.role === 'model') {
          this.appendBotMessage(item.text, item.actions || [], false, item.query);
        }
      });
      this.scrollToBottom();
    }

    async handleUserSubmit(query) {
      if (!query) return;

      // Hide initial suggestions once user starts chatting
      if (this.dom.initialSuggestions) {
        this.dom.initialSuggestions.style.display = 'none';
      }

      this.dom.input.value = '';
      this.appendUserMessage(query, true);

      this.showTypingIndicator();
      this.isTyping = true;
      this.dom.sendBtn.disabled = true;

      try {
        const response = await fetch('api/chat.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: query,
            history: this.getHistoryForApi()
          })
        });

        const data = await response.json();
        this.hideTypingIndicator();
        this.isTyping = false;
        this.dom.sendBtn.disabled = false;

        if (data.success && data.reply) {
          this.appendBotMessage(data.reply, data.actions || [], true, query);
        } else {
          const fallbackMsg = data.error || "For immediate assistance, please contact our Site Engineer directly at +91 99703 53935.";
          this.appendBotMessage(fallbackMsg, data.actions || [
            { label: 'Call Site Engineer', url: 'tel:+919970353935', type: 'call' }
          ], true, query);
        }
      } catch (err) {
        this.hideTypingIndicator();
        this.isTyping = false;
        this.dom.sendBtn.disabled = false;
        this.appendBotMessage("I am temporarily connecting with the on-site desk. Please call our Site Engineer directly at **+91 99703 53935**.", [
          { label: 'Call Site Engineer', url: 'tel:+919970353935', type: 'call' },
          { label: 'Message on WhatsApp', url: 'https://wa.me/919970353935?text=Hello%20Deccan%20Imperia', type: 'whatsapp' }
        ], true, query);
      }
    }

    getHistoryForApi() {
      // Send last 6 turns to keep context crisp and fast
      return this.history.slice(-6).map(h => ({
        role: h.role,
        parts: [{ text: h.text }]
      }));
    }

    appendUserMessage(text, save = true) {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'imperia-chat-msg user';
      msgDiv.innerHTML = `<div class="imperia-chat-bubble">${this.escapeHtml(text)}</div>`;
      this.dom.messages.appendChild(msgDiv);
      this.scrollToBottom();

      if (save) {
        this.history.push({ role: 'user', text });
        this.saveHistory();
      }
    }

    appendBotMessage(text, actions = [], save = true, queryContext = '') {
      const msgDiv = document.createElement('div');
      msgDiv.className = 'imperia-chat-msg bot';

      const formattedHtml = this.parseMarkdown(text);

      let actionsHtml = '';
      if (actions && actions.length > 0) {
        actionsHtml = `
          <div class="imperia-chat-actions">
            ${actions.map(act => `
              <a href="${act.url}" class="imperia-action-chip ${act.type || ''}" target="${act.type === 'call' ? '_self' : '_blank'}" rel="noopener">
                ${act.type === 'whatsapp' ? '💬 ' : act.type === 'call' ? '📞 ' : '📄 '}
                ${act.label}
              </a>
            `).join('')}
          </div>
        `;
      }

      const feedbackHtml = `
        <div class="imperia-chat-feedback-row">
          <button class="imperia-chat-feedback-btn" data-rating="up" data-query="${this.escapeHtml(queryContext)}" title="Helpful answer">👍</button>
          <button class="imperia-chat-feedback-btn" data-rating="down" data-query="${this.escapeHtml(queryContext)}" title="Not helpful">👎</button>
        </div>
      `;

      msgDiv.innerHTML = `
        <div class="imperia-chat-bubble">
          ${formattedHtml}
          ${actionsHtml}
        </div>
        ${feedbackHtml}
      `;

      this.dom.messages.appendChild(msgDiv);
      this.scrollToBottom();

      if (save) {
        this.history.push({ role: 'model', text, actions, query: queryContext });
        this.saveHistory();
      }
    }

    async handleFeedback(btn) {
      const rating = btn.dataset.rating;
      const query = btn.dataset.query;
      const row = btn.closest('.imperia-chat-feedback-row');

      row.querySelectorAll('.imperia-chat-feedback-btn').forEach(b => {
        b.classList.add('rated');
        if (b !== btn) b.style.opacity = '0.3';
      });

      try {
        await fetch('api/feedback.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rating, query })
        });
      } catch (e) {}
    }

    showTypingIndicator() {
      let typingDiv = document.getElementById('imperiaTypingIndicator');
      if (!typingDiv) {
        typingDiv = document.createElement('div');
        typingDiv.className = 'imperia-chat-typing';
        typingDiv.id = 'imperiaTypingIndicator';
        typingDiv.innerHTML = '<span></span><span></span><span></span>';
        this.dom.messages.appendChild(typingDiv);
      }
      this.scrollToBottom();
    }

    hideTypingIndicator() {
      const typingDiv = document.getElementById('imperiaTypingIndicator');
      if (typingDiv) {
        typingDiv.remove();
      }
    }

    scrollToBottom() {
      this.dom.messages.scrollTop = this.dom.messages.scrollHeight;
    }

    escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    parseMarkdown(md) {
      if (!md) return '';
      let html = md.trim();

      // Bold **text**
      html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      // Italic *text*
      html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

      // Clickable phone links: +91 99703 53935
      html = html.replace(/(\+91[\s\-]?[0-9]{5}[\s\-]?[0-9]{5})/g, '<a href="tel:$1" style="color:var(--chat-gold);font-weight:600;text-decoration:none;">$1</a>');

      // Convert paragraphs
      const paragraphs = html.split(/\n\n+/);
      const formatted = paragraphs.map(p => {
        const trimmed = p.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          const listItems = trimmed.split(/\n[-*]\s+/).filter(Boolean);
          return '<ul>' + listItems.map(item => `<li>${item.replace(/^[-*]\s+/, '')}</li>`).join('') + '</ul>';
        }
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
      });

      return formatted.join('');
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.DeccanImperiaChatbot = new ImperiaChatbot();
    });
  } else {
    window.DeccanImperiaChatbot = new ImperiaChatbot();
  }
})();

/**
 * Meeting Intelligence Chat Interface
 * Provides conversational access to meeting data through natural language queries
 */

class MeetingIntelligenceChat {
  constructor() {
    this.isOpen = false;
    this.conversationHistory = [];
    this.isProcessing = false;
    
    this.initializeElements();
    this.bindEvents();
    this.loadConversationHistory();
  }

  initializeElements() {
    this.chatToggle = document.getElementById('chat-toggle');
    this.chatPanel = document.getElementById('chat-panel');
    this.chatClose = document.getElementById('chat-close');
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.chatSend = document.getElementById('chat-send');
    
    if (!this.chatToggle || !this.chatPanel) {
      console.warn('Chat elements not found');
      return;
    }
  }

  bindEvents() {
    // Toggle chat panel
    this.chatToggle?.addEventListener('click', () => this.toggleChat());
    this.chatClose?.addEventListener('click', () => this.closeChat());
    
    // Send message events
    this.chatSend?.addEventListener('click', () => this.sendMessage());
    this.chatInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });
    
    // Input validation
    this.chatInput?.addEventListener('input', () => {
      const hasText = this.chatInput.value.trim().length > 0;
      if (this.chatSend) {
        this.chatSend.disabled = !hasText || this.isProcessing;
      }
    });
    
    // Quick action buttons
    this.chatMessages?.addEventListener('click', (e) => {
      if (e.target.classList.contains('quick-action')) {
        const query = e.target.getAttribute('data-query');
        if (query) {
          this.chatInput.value = query;
          this.sendMessage();
        }
      }
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && 
          !this.chatPanel.contains(e.target) && 
          !this.chatToggle.contains(e.target)) {
        this.closeChat();
      }
    });
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
    this.chatPanel?.classList.add('open');
    this.chatToggle?.classList.add('active');
    
    // Focus input after animation
    setTimeout(() => {
      this.chatInput?.focus();
    }, 300);
  }

  closeChat() {
    this.isOpen = false;
    this.chatPanel?.classList.remove('open');
    this.chatToggle?.classList.remove('active');
  }

  async sendMessage() {
    const query = this.chatInput?.value.trim();
    if (!query || this.isProcessing) return;

    // Add user message to chat
    this.addMessage('user', query);
    
    // Clear input and disable send button
    this.chatInput.value = '';
    this.updateSendButton();
    
    // Show typing indicator
    this.showTypingIndicator();
    
    try {
      this.isProcessing = true;
      
      // Send query to API
      const response = await fetch('/api/intelligence/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      });

      const data = await response.json();
      
      // Remove typing indicator
      this.hideTypingIndicator();
      
      if (response.ok) {
        // Add assistant response
        this.addMessage('assistant', data.response, data);
        
        // Store conversation
        this.conversationHistory.push(
          { role: 'user', content: query, timestamp: new Date().toISOString() },
          { role: 'assistant', content: data.response, data: data, timestamp: new Date().toISOString() }
        );
        this.saveConversationHistory();
        
      } else {
        this.addErrorMessage(`Sorry, I encountered an error: ${data.error || 'Unknown error'}`);
      }
      
    } catch (error) {
      console.error('Chat error:', error);
      this.hideTypingIndicator();
      this.addErrorMessage('Sorry, I\'m having trouble connecting. Please try again.');
    } finally {
      this.isProcessing = false;
      this.updateSendButton();
    }
  }

  addMessage(sender, content, data = null) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${sender}`;
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    
    if (sender === 'assistant' && data) {
      messageContent.innerHTML = this.formatAssistantMessage(content, data);
    } else {
      messageContent.innerHTML = `<p>${this.escapeHtml(content)}</p>`;
    }
    
    messageDiv.appendChild(messageContent);
    this.chatMessages?.appendChild(messageDiv);
    this.scrollToBottom();
  }

  formatAssistantMessage(content, data) {
    let html = `<p>${this.escapeHtml(content)}</p>`;
    
    // Add structured data if available
    if (data.results && data.results.length > 0) {
      html += '<div style="margin-top: 12px; padding: 8px; background: rgba(102, 126, 234, 0.1); border-radius: 8px;">';
      html += `<small style="color: #667eea; font-weight: 600;">Found ${data.results.length} result(s)</small>`;
      html += '</div>';
    }
    
    // Add follow-up suggestions if available
    if (data.followUpSuggestions && data.followUpSuggestions.length > 0) {
      html += '<div class="quick-actions" style="margin-top: 12px;">';
      data.followUpSuggestions.forEach(suggestion => {
        html += `<button class="quick-action" data-query="${this.escapeHtml(suggestion)}">${this.escapeHtml(suggestion)}</button>`;
      });
      html += '</div>';
    }
    
    return html;
  }

  addErrorMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';
    
    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.innerHTML = `<div class="error-message">${this.escapeHtml(message)}</div>`;
    
    messageDiv.appendChild(messageContent);
    this.chatMessages?.appendChild(messageDiv);
    this.scrollToBottom();
  }

  showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'typing-indicator';
    typingDiv.id = 'typing-indicator';
    typingDiv.innerHTML = `
      <span>Assistant is thinking</span>
      <div class="typing-dots">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    
    this.chatMessages?.appendChild(typingDiv);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  updateSendButton() {
    if (this.chatSend) {
      const hasText = this.chatInput?.value.trim().length > 0;
      this.chatSend.disabled = !hasText || this.isProcessing;
    }
  }

  scrollToBottom() {
    if (this.chatMessages) {
      this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Conversation persistence
  saveConversationHistory() {
    try {
      // Keep only last 50 messages to avoid storage issues
      const recentHistory = this.conversationHistory.slice(-50);
      localStorage.setItem('meetingIntelligenceChat', JSON.stringify(recentHistory));
    } catch (error) {
      console.warn('Could not save conversation history:', error);
    }
  }

  loadConversationHistory() {
    try {
      const saved = localStorage.getItem('meetingIntelligenceChat');
      if (saved) {
        this.conversationHistory = JSON.parse(saved);
        
        // Restore recent conversation (last 10 messages)
        const recentMessages = this.conversationHistory.slice(-10);
        recentMessages.forEach(msg => {
          if (msg.role === 'user') {
            this.addMessage('user', msg.content);
          } else if (msg.role === 'assistant') {
            this.addMessage('assistant', msg.content, msg.data);
          }
        });
      }
    } catch (error) {
      console.warn('Could not load conversation history:', error);
    }
  }

  clearConversation() {
    this.conversationHistory = [];
    this.chatMessages.innerHTML = `
      <div class="chat-message assistant">
        <div class="message-content">
          <p>👋 Hi! I'm your Meeting Intelligence assistant. I can help you find information about your meetings, participants, documents, and collaboration patterns.</p>
          <div class="quick-actions">
            <button class="quick-action" data-query="Show me meetings from this week">This week's meetings</button>
            <button class="quick-action" data-query="Who did I meet with recently?">Recent participants</button>
            <button class="quick-action" data-query="Find documents from yesterday's meetings">Yesterday's documents</button>
          </div>
        </div>
      </div>
    `;
    this.saveConversationHistory();
  }
}

// Initialize chat when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.meetingChat = new MeetingIntelligenceChat();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MeetingIntelligenceChat;
}

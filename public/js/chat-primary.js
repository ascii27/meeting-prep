/**
 * Chat-First Primary Interface JavaScript
 * Handles the main chat experience and UI interactions
 */

class ChatPrimaryInterface {
  constructor() {
    this.chatInput = document.getElementById('chat-input');
    this.sendBtn = document.getElementById('send-btn');
    this.chatConversation = document.getElementById('chat-conversation');
    this.contextIndicator = document.getElementById('context-indicator');
    this.contextStatus = this.contextIndicator?.querySelector('.context-status');
    this.contextText = this.contextIndicator?.querySelector('.context-text');
    this.sidebarToggle = document.getElementById('sidebar-toggle');
    this.contextSidebar = document.getElementById('context-sidebar');
    this.viewToggle = document.getElementById('view-toggle');
    this.traditionalView = document.getElementById('traditional-view');
    this.loadingOverlay = document.getElementById('loading-overlay');
    
    this.conversationHistory = [];
    this.isProcessing = false;
    this.currentContext = {};
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupAutoResize();
    this.loadConversationHistory();
    this.updateQuickStats();
    this.setupKeyboardShortcuts();
  }

  setupEventListeners() {
    // Chat input events
    this.chatInput?.addEventListener('input', () => {
      this.handleInputChange();
      this.updateCharCounter();
    });

    this.chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // Send button
    this.sendBtn?.addEventListener('click', () => this.sendMessage());

    // Suggestion cards
    document.addEventListener('click', (e) => {
      if (e.target.closest('.suggestion-card')) {
        const query = e.target.closest('.suggestion-card').dataset.query;
        this.sendMessage(query);
      }
    });

    // Follow-up suggestions
    document.addEventListener('click', (e) => {
      if (e.target.closest('.followup-suggestion')) {
        const query = e.target.closest('.followup-suggestion').textContent;
        this.sendMessage(query);
      }
    });

    // Sidebar toggle
    this.sidebarToggle?.addEventListener('click', () => {
      this.toggleSidebar();
    });

    // View toggle
    this.viewToggle?.addEventListener('click', () => {
      this.showTraditionalView();
    });

    // Traditional view close
    document.getElementById('close-traditional')?.addEventListener('click', () => {
      this.hideTraditionalView();
    });

    // Click outside traditional view to close
    this.traditionalView?.addEventListener('click', (e) => {
      if (e.target === this.traditionalView) {
        this.hideTraditionalView();
      }
    });
  }

  setupAutoResize() {
    if (!this.chatInput) return;

    this.chatInput.addEventListener('input', () => {
      this.chatInput.style.height = 'auto';
      this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Cmd/Ctrl + K to focus chat input
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        this.chatInput?.focus();
      }

      // Escape to clear input or close traditional view
      if (e.key === 'Escape') {
        if (this.traditionalView?.style.display !== 'none') {
          this.hideTraditionalView();
        } else if (this.chatInput?.value) {
          this.chatInput.value = '';
          this.handleInputChange();
        }
      }
    });
  }

  handleInputChange() {
    const hasValue = this.chatInput?.value.trim().length > 0;
    if (this.sendBtn) {
      this.sendBtn.disabled = !hasValue || this.isProcessing;
    }

    // Show/hide input suggestions based on input
    this.updateInputSuggestions();
  }

  updateCharCounter() {
    const counter = document.getElementById('char-counter');
    if (counter && this.chatInput) {
      const length = this.chatInput.value.length;
      counter.textContent = `${length}/1000`;
      
      if (length > 900) {
        counter.style.color = '#f56565';
      } else if (length > 800) {
        counter.style.color = '#ed8936';
      } else {
        counter.style.color = '#a0aec0';
      }
    }
  }

  async sendMessage(message = null) {
    const query = message || this.chatInput?.value.trim();
    if (!query || this.isProcessing) return;

    this.isProcessing = true;
    this.updateContextStatus('thinking', 'Processing your request...');

    // Clear input
    if (this.chatInput && !message) {
      this.chatInput.value = '';
      this.chatInput.style.height = 'auto';
      this.handleInputChange();
    }

    // Add user message to conversation
    this.addMessage('user', query);

    // Show loading state
    const loadingMessageId = this.addMessage('assistant', '', true);

    try {
      // Send request to intelligence API
      const response = await fetch('/api/intelligence/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: query,
          context: this.currentContext,
          conversationHistory: this.conversationHistory.slice(-5) // Last 5 messages
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      // Remove loading message
      this.removeMessage(loadingMessageId);

      // Add assistant response
      this.addIntelligentResponse(data);

      // Update conversation history
      this.conversationHistory.push(
        { role: 'user', content: query, timestamp: new Date().toISOString() },
        { role: 'assistant', content: data, timestamp: new Date().toISOString() }
      );

      // Update context
      this.currentContext = { ...this.currentContext, ...data.context };

      // Update sidebar stats
      this.updateQuickStats();

      this.updateContextStatus('active', 'Ready to help with your meetings');

    } catch (error) {
      console.error('Error sending message:', error);
      
      // Remove loading message
      this.removeMessage(loadingMessageId);

      // Add error message
      this.addMessage('assistant', `I'm sorry, I encountered an error processing your request: ${error.message}. Please try again.`);
      
      this.updateContextStatus('error', 'Error processing request');
      
      // Reset status after a delay
      setTimeout(() => {
        this.updateContextStatus('active', 'Ready to help with your meetings');
      }, 3000);
    } finally {
      this.isProcessing = false;
      this.handleInputChange();
    }
  }

  addMessage(role, content, isLoading = false) {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${role}`;
    messageDiv.id = messageId;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    
    if (role === 'assistant') {
      avatar.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
        </svg>
      `;
    } else {
      avatar.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      `;
    }

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    if (isLoading) {
      messageContent.innerHTML = `
        <div class="message-text">
          <div class="component-loading">
            <div class="component-loading-spinner"></div>
            <span>Thinking...</span>
          </div>
        </div>
      `;
    } else {
      const messageText = document.createElement('div');
      messageText.className = 'message-text';
      messageText.innerHTML = `<p>${this.formatMessage(content)}</p>`;
      messageContent.appendChild(messageText);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    this.chatConversation?.appendChild(messageDiv);
    this.scrollToBottom();

    return messageId;
  }

  removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
      message.remove();
    }
  }

  addIntelligentResponse(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message assistant';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"></path>
      </svg>
    `;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    // Add main response text
    if (data.response) {
      const messageText = document.createElement('div');
      messageText.className = 'message-text';
      messageText.innerHTML = `<p>${this.formatMessage(data.response)}</p>`;
      messageContent.appendChild(messageText);
    }

    // Add visualizations if available
    if (data.visualizations && data.visualizations.length > 0) {
      data.visualizations.forEach(viz => {
        this.addVisualizationComponent(messageContent, viz);
      });
    }

    // Add rich components based on data
    if (data.data && data.data.length > 0) {
      this.addRichComponents(messageContent, data);
    }

    // Add follow-up suggestions
    if (data.followUpSuggestions && data.followUpSuggestions.length > 0) {
      this.addFollowUpSuggestions(messageContent, data.followUpSuggestions);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(messageContent);

    this.chatConversation?.appendChild(messageDiv);
    this.scrollToBottom();
  }

  addRichComponents(messageContent, data) {
    switch (data.type) {
      case 'meetings':
        this.addMeetingCards(messageContent, data.data);
        break;
      case 'participants':
        this.addParticipantTable(messageContent, data.data);
        break;
      case 'documents':
        this.addDocumentPreviews(messageContent, data.data);
        break;
      case 'statistics':
        this.addStatisticsCards(messageContent, data.data);
        break;
      case 'organization':
        this.addOrganizationVisualization(messageContent, data.data);
        break;
      case 'collaboration':
        this.addCollaborationVisualization(messageContent, data.data);
        break;
      case 'timeline':
        this.addTimelineVisualization(messageContent, data.data);
        break;
      case 'departments':
        this.addDepartmentVisualization(messageContent, data.data);
        break;
      case 'topics':
        this.addTopicVisualization(messageContent, data.data);
        break;
      default:
        this.addDataTable(messageContent, data.data);
    }
  }

  addMeetingCards(container, meetings) {
    meetings.slice(0, 5).forEach(meeting => {
      const card = document.createElement('div');
      card.className = 'chat-meeting-card';
      
      card.innerHTML = `
        <div class="meeting-card-header">
          <h4 class="meeting-card-title">${meeting.title || 'Untitled Meeting'}</h4>
          <div class="meeting-card-time">${this.formatDate(meeting.startTime)}</div>
        </div>
        <div class="meeting-card-details">
          ${meeting.location ? `
            <div class="meeting-detail-item">
              <svg class="meeting-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                <circle cx="12" cy="10" r="3"></circle>
              </svg>
              <span>${meeting.location}</span>
            </div>
          ` : ''}
          <div class="meeting-detail-item">
            <svg class="meeting-detail-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span>${meeting.attendeeCount || 0} participants</span>
          </div>
        </div>
        ${meeting.participants ? `
          <div class="meeting-card-participants">
            ${meeting.participants.slice(0, 5).map(p => `<span class="participant-pill">${p.name || p.email}</span>`).join('')}
            ${meeting.participants.length > 5 ? `<span class="participant-pill">+${meeting.participants.length - 5} more</span>` : ''}
          </div>
        ` : ''}
      `;
      
      container.appendChild(card);
    });

    if (meetings.length > 5) {
      const moreInfo = document.createElement('div');
      moreInfo.className = 'message-text';
      moreInfo.innerHTML = `<p><em>Showing 5 of ${meetings.length} meetings. Ask me to show more or filter by specific criteria.</em></p>`;
      container.appendChild(moreInfo);
    }
  }

  addParticipantTable(container, participants) {
    const table = document.createElement('div');
    table.className = 'chat-data-table';
    
    table.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Participant</th>
            <th>Meeting Count</th>
            <th>Last Meeting</th>
          </tr>
        </thead>
        <tbody>
          ${participants.slice(0, 10).map(p => `
            <tr>
              <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 24px; height: 24px; border-radius: 50%; background: #667eea; color: white; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600;">
                    ${(p.name || p.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style="font-weight: 500;">${p.name || 'Unknown'}</div>
                    <div style="font-size: 0.75rem; color: #a0aec0;">${p.email || ''}</div>
                  </div>
                </div>
              </td>
              <td>${p.meetingCount || 0}</td>
              <td>${p.lastMeeting ? this.formatDate(p.lastMeeting) : 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    container.appendChild(table);
  }

  addFollowUpSuggestions(container, suggestions) {
    const followUpDiv = document.createElement('div');
    followUpDiv.className = 'chat-followup-suggestions';
    
    followUpDiv.innerHTML = `
      <div class="followup-header">💡 You might also want to ask:</div>
      <div class="followup-suggestions-list">
        ${suggestions.map(suggestion => `
          <button class="followup-suggestion">${suggestion}</button>
        `).join('')}
      </div>
    `;
    
    container.appendChild(followUpDiv);
  }

  addOrganizationVisualization(container, data) {
    if (window.chatVisualizations) {
      window.chatVisualizations.createOrganizationChart(container, data);
    } else {
      this.addFallbackVisualization(container, 'Organization Chart', data);
    }
  }

  addCollaborationVisualization(container, data) {
    if (window.chatVisualizations) {
      window.chatVisualizations.createCollaborationNetwork(container, data);
    } else {
      this.addFallbackVisualization(container, 'Collaboration Network', data);
    }
  }

  addTimelineVisualization(container, data) {
    if (window.chatVisualizations) {
      window.chatVisualizations.createMeetingTimeline(container, data);
    } else {
      this.addFallbackVisualization(container, 'Meeting Timeline', data);
    }
  }

  addDepartmentVisualization(container, data) {
    if (window.chatVisualizations) {
      window.chatVisualizations.createDepartmentStats(container, data);
    } else {
      this.addFallbackVisualization(container, 'Department Statistics', data);
    }
  }

  addTopicVisualization(container, data) {
    if (window.chatVisualizations) {
      window.chatVisualizations.createTopicEvolution(container, data);
    } else {
      this.addFallbackVisualization(container, 'Topic Evolution', data);
    }
  }

  addVisualizationComponent(container, visualization) {
    const vizContainer = document.createElement('div');
    vizContainer.className = 'chat-visualization-container';
    
    // Add visualization title if provided
    if (visualization.title) {
      const title = document.createElement('h4');
      title.className = 'visualization-title';
      title.textContent = visualization.title;
      vizContainer.appendChild(title);
    }
    
    // Add the visualization based on type
    switch (visualization.type) {
      case 'organization':
        this.addOrganizationVisualization(vizContainer, visualization.data);
        break;
      case 'collaboration':
        this.addCollaborationVisualization(vizContainer, visualization.data);
        break;
      case 'timeline':
        this.addTimelineVisualization(vizContainer, visualization.data);
        break;
      case 'departments':
        this.addDepartmentVisualization(vizContainer, visualization.data);
        break;
      case 'topics':
        this.addTopicVisualization(vizContainer, visualization.data);
        break;
      default:
        console.warn('Unknown visualization type:', visualization.type);
    }
    
    container.appendChild(vizContainer);
  }

  addFallbackVisualization(container, title, data) {
    const fallback = document.createElement('div');
    fallback.className = 'chat-chart-container';
    
    fallback.innerHTML = `
      <div class="chart-header">
        <h3 class="chart-title">${title}</h3>
      </div>
      <div class="chart-content">
        <div class="chart-loading">
          <div class="chart-loading-spinner"></div>
          <span>Loading visualization...</span>
        </div>
      </div>
    `;
    
    container.appendChild(fallback);
    
    // Try to load visualization after a delay
    setTimeout(() => {
      if (window.chatVisualizations) {
        fallback.remove();
        switch (title) {
          case 'Organization Chart':
            this.addOrganizationVisualization(container, data);
            break;
          case 'Collaboration Network':
            this.addCollaborationVisualization(container, data);
            break;
          case 'Meeting Timeline':
            this.addTimelineVisualization(container, data);
            break;
          case 'Department Statistics':
            this.addDepartmentVisualization(container, data);
            break;
          case 'Topic Evolution':
            this.addTopicVisualization(container, data);
            break;
        }
      } else {
        // Show error state
        fallback.querySelector('.chart-content').innerHTML = `
          <div class="chart-error">
            <span>Unable to load ${title} visualization</span>
          </div>
        `;
      }
    }, 2000);
  }

  addDataTable(container, data) {
    if (!Array.isArray(data) || data.length === 0) return;

    const table = document.createElement('div');
    table.className = 'chat-data-table';
    
    const headers = Object.keys(data[0]);
    
    table.innerHTML = `
      <table>
        <thead>
          <tr>
            ${headers.map(header => `<th>${this.formatHeader(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.slice(0, 10).map(row => `
            <tr>
              ${headers.map(header => `<td>${this.formatCellValue(row[header])}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    container.appendChild(table);
  }

  formatMessage(message) {
    if (!message) return '';
    
    // Convert markdown-like formatting
    return message
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  formatHeader(header) {
    return header
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  formatCellValue(value) {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  updateContextStatus(status, text) {
    if (this.contextStatus) {
      this.contextStatus.className = `context-status ${status}`;
    }
    if (this.contextText) {
      this.contextText.textContent = text;
    }
  }

  updateInputSuggestions() {
    // This would show contextual suggestions based on current input
    // Implementation would depend on the specific requirements
  }

  async updateQuickStats() {
    try {
      const response = await fetch('/api/intelligence/stats/quick');
      if (response.ok) {
        const stats = await response.json();
        
        document.getElementById('meetings-this-week').textContent = stats.meetingsThisWeek || '-';
        document.getElementById('participants-count').textContent = stats.participantsCount || '-';
        document.getElementById('documents-count').textContent = stats.documentsCount || '-';
      }
    } catch (error) {
      console.error('Error updating quick stats:', error);
    }
  }

  toggleSidebar() {
    this.contextSidebar?.classList.toggle('collapsed');
    
    const toggle = this.sidebarToggle?.querySelector('svg polyline');
    if (toggle) {
      const isCollapsed = this.contextSidebar?.classList.contains('collapsed');
      toggle.setAttribute('points', isCollapsed ? '9,18 15,12 9,6' : '15,18 9,12 15,6');
    }
  }

  showTraditionalView() {
    if (this.traditionalView) {
      this.traditionalView.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      
      // Load traditional dashboard content
      this.loadTraditionalDashboard();
    }
  }

  hideTraditionalView() {
    if (this.traditionalView) {
      this.traditionalView.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  }

  async loadTraditionalDashboard() {
    const content = document.getElementById('traditional-dashboard-content');
    if (!content) return;

    content.innerHTML = '<div class="component-loading"><div class="component-loading-spinner"></div><span>Loading traditional view...</span></div>';

    try {
      const response = await fetch('/dashboard/traditional');
      if (response.ok) {
        const html = await response.text();
        content.innerHTML = html;
      } else {
        content.innerHTML = '<div class="component-error">Failed to load traditional dashboard view.</div>';
      }
    } catch (error) {
      console.error('Error loading traditional dashboard:', error);
      content.innerHTML = '<div class="component-error">Error loading traditional dashboard view.</div>';
    }
  }

  loadConversationHistory() {
    // Load conversation history from localStorage or API
    const saved = localStorage.getItem('meeting-intelligence-conversation');
    if (saved) {
      try {
        this.conversationHistory = JSON.parse(saved);
      } catch (error) {
        console.error('Error loading conversation history:', error);
        this.conversationHistory = [];
      }
    }
  }

  saveConversationHistory() {
    try {
      localStorage.setItem('meeting-intelligence-conversation', JSON.stringify(this.conversationHistory));
    } catch (error) {
      console.error('Error saving conversation history:', error);
    }
  }

  scrollToBottom() {
    if (this.chatConversation) {
      this.chatConversation.scrollTop = this.chatConversation.scrollHeight;
    }
  }
}

// Initialize the chat interface when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.chatInterface = new ChatPrimaryInterface();
});

// Auto-save conversation history periodically
setInterval(() => {
  if (window.chatInterface) {
    window.chatInterface.saveConversationHistory();
  }
}, 30000); // Every 30 seconds

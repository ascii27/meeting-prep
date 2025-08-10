/**
 * Chat Components - Handles rich interactive elements and data transformation
 * Bridges between LLM responses and visualization components
 */

class ChatComponentsManager {
  constructor() {
    this.componentRegistry = new Map();
    this.dataTransformers = new Map();
    this.init();
  }

  init() {
    this.registerDataTransformers();
    this.setupComponentInteractions();
  }

  /**
   * Register data transformers for different response types
   */
  registerDataTransformers() {
    // Organization data transformer
    this.dataTransformers.set('organization', (data) => {
      return {
        nodes: data.hierarchy || data.people || [],
        relationships: data.relationships || [],
        departments: data.departments || []
      };
    });

    // Collaboration data transformer
    this.dataTransformers.set('collaboration', (data) => {
      return {
        relationships: data.collaborations || data.relationships || [],
        nodes: data.participants || data.people || [],
        strength: data.strength || 'medium'
      };
    });

    // Timeline data transformer
    this.dataTransformers.set('timeline', (data) => {
      return {
        timeline: data.timeline || data.meetings?.map(m => ({
          date: m.startTime || m.date,
          count: m.count || 1,
          title: m.title
        })) || []
      };
    });

    // Department stats transformer
    this.dataTransformers.set('departments', (data) => {
      return {
        departments: data.departments || data.stats || []
      };
    });

    // Topic evolution transformer
    this.dataTransformers.set('topics', (data) => {
      return {
        topics: data.topics || data.keywords || []
      };
    });

    // Meeting data transformer
    this.dataTransformers.set('meetings', (data) => {
      return data.meetings || data.events || data;
    });

    // Participants transformer
    this.dataTransformers.set('participants', (data) => {
      return data.participants || data.people || data.attendees || data;
    });
  }

  /**
   * Transform raw API data for visualization components
   */
  transformDataForVisualization(type, rawData) {
    const transformer = this.dataTransformers.get(type);
    if (transformer) {
      return transformer(rawData);
    }
    return rawData;
  }

  /**
   * Setup component interactions and event handlers
   */
  setupComponentInteractions() {
    // Handle expandable sections
    document.addEventListener('click', (e) => {
      if (e.target.closest('.expandable-header')) {
        this.toggleExpandableSection(e.target.closest('.expandable-section'));
      }
    });

    // Handle action item checkboxes
    document.addEventListener('click', (e) => {
      if (e.target.closest('.action-checkbox')) {
        this.toggleActionItem(e.target.closest('.action-item'));
      }
    });

    // Handle document action buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.document-action-btn')) {
        this.handleDocumentAction(e.target.closest('.document-action-btn'));
      }
    });

    // Handle meeting card interactions
    document.addEventListener('click', (e) => {
      if (e.target.closest('.chat-meeting-card')) {
        this.handleMeetingCardClick(e.target.closest('.chat-meeting-card'));
      }
    });
  }

  /**
   * Toggle expandable sections
   */
  toggleExpandableSection(section) {
    const isExpanded = section.classList.contains('expanded');
    
    if (isExpanded) {
      section.classList.remove('expanded');
    } else {
      section.classList.add('expanded');
    }
  }

  /**
   * Toggle action item completion
   */
  toggleActionItem(actionItem) {
    const checkbox = actionItem.querySelector('.action-checkbox');
    const isCompleted = actionItem.classList.contains('completed');
    
    if (isCompleted) {
      actionItem.classList.remove('completed');
      checkbox.classList.remove('completed');
      checkbox.innerHTML = '';
    } else {
      actionItem.classList.add('completed');
      checkbox.classList.add('completed');
      checkbox.innerHTML = '✓';
    }

    // Trigger action item update
    this.updateActionItemStatus(actionItem, !isCompleted);
  }

  /**
   * Handle document action buttons
   */
  handleDocumentAction(button) {
    const action = button.dataset.action || button.textContent.toLowerCase();
    const documentCard = button.closest('.chat-document-preview');
    const documentId = documentCard?.dataset.documentId;

    switch (action) {
      case 'view':
      case 'open':
        this.openDocument(documentId);
        break;
      case 'download':
        this.downloadDocument(documentId);
        break;
      case 'share':
        this.shareDocument(documentId);
        break;
      default:
        console.log('Unknown document action:', action);
    }
  }

  /**
   * Handle meeting card clicks
   */
  handleMeetingCardClick(card) {
    const meetingId = card.dataset.meetingId;
    if (meetingId && window.chatInterface) {
      const query = `Tell me more about the meeting with ID ${meetingId}`;
      window.chatInterface.sendMessage(query);
    }
  }

  /**
   * Create action items component
   */
  createActionItemsComponent(container, actionItems) {
    const component = document.createElement('div');
    component.className = 'chat-action-items';
    
    const completedCount = actionItems.filter(item => item.completed).length;
    
    component.innerHTML = `
      <div class="action-items-header">
        <h3 class="action-items-title">Action Items</h3>
        <div class="action-items-count">${completedCount}/${actionItems.length}</div>
      </div>
      <div class="action-items-list">
        ${actionItems.map(item => this.renderActionItem(item)).join('')}
      </div>
    `;
    
    container.appendChild(component);
  }

  /**
   * Render individual action item
   */
  renderActionItem(item) {
    return `
      <div class="action-item ${item.completed ? 'completed' : ''}" data-item-id="${item.id}">
        <div class="action-checkbox ${item.completed ? 'completed' : ''}">
          ${item.completed ? '✓' : ''}
        </div>
        <div class="action-item-content">
          <div class="action-item-text">${item.text || item.description}</div>
          <div class="action-item-meta">
            ${item.assignee ? `<span>Assigned to: ${item.assignee}</span>` : ''}
            ${item.dueDate ? `<span>Due: ${this.formatDate(item.dueDate)}</span>` : ''}
            ${item.priority ? `<span>Priority: ${item.priority}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create statistics cards component
   */
  createStatisticsCards(container, stats) {
    const component = document.createElement('div');
    component.className = 'chat-stats-grid';
    
    component.innerHTML = stats.map(stat => `
      <div class="chat-stat-card">
        <div class="stat-card-value">${stat.value}</div>
        <div class="stat-card-label">${stat.label}</div>
        ${stat.change ? `
          <div class="stat-card-change ${stat.change > 0 ? 'positive' : 'negative'}">
            ${stat.change > 0 ? '+' : ''}${stat.change}%
          </div>
        ` : ''}
      </div>
    `).join('');
    
    container.appendChild(component);
  }

  /**
   * Create document preview component
   */
  createDocumentPreview(container, document) {
    const component = document.createElement('div');
    component.className = 'chat-document-preview';
    component.dataset.documentId = document.id;
    
    component.innerHTML = `
      <div class="document-preview-header">
        <div class="document-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14,2 14,8 20,8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10,9 9,9 8,9"></polyline>
          </svg>
        </div>
        <div class="document-info">
          <div class="document-title">${document.title || document.name}</div>
          <div class="document-meta">
            ${document.type || 'Document'} • ${this.formatDate(document.lastModified || document.createdAt)}
          </div>
        </div>
      </div>
      ${document.preview ? `
        <div class="document-preview-content">
          ${document.preview}
        </div>
      ` : ''}
      <div class="document-actions">
        <button class="document-action-btn" data-action="view">View</button>
        ${document.downloadUrl ? '<button class="document-action-btn" data-action="download">Download</button>' : ''}
        <button class="document-action-btn" data-action="share">Share</button>
      </div>
    `;
    
    container.appendChild(component);
  }

  /**
   * Create expandable section component
   */
  createExpandableSection(container, title, content, expanded = false) {
    const component = document.createElement('div');
    component.className = `expandable-section ${expanded ? 'expanded' : ''}`;
    
    component.innerHTML = `
      <div class="expandable-header">
        <h4 class="expandable-title">${title}</h4>
        <svg class="expandable-toggle" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6,9 12,15 18,9"></polyline>
        </svg>
      </div>
      <div class="expandable-content">
        <div class="expandable-content-inner">
          ${content}
        </div>
      </div>
    `;
    
    container.appendChild(component);
  }

  /**
   * Update action item status
   */
  async updateActionItemStatus(actionItem, completed) {
    const itemId = actionItem.dataset.itemId;
    if (!itemId) return;

    try {
      await fetch(`/api/intelligence/action-items/${itemId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ completed })
      });
    } catch (error) {
      console.error('Error updating action item:', error);
      // Revert the visual change if the API call failed
      this.toggleActionItem(actionItem);
    }
  }

  /**
   * Open document
   */
  openDocument(documentId) {
    if (documentId) {
      window.open(`/api/documents/${documentId}/view`, '_blank');
    }
  }

  /**
   * Download document
   */
  downloadDocument(documentId) {
    if (documentId) {
      const link = document.createElement('a');
      link.href = `/api/documents/${documentId}/download`;
      link.download = '';
      link.click();
    }
  }

  /**
   * Share document
   */
  shareDocument(documentId) {
    if (documentId && navigator.share) {
      navigator.share({
        title: 'Meeting Document',
        url: `${window.location.origin}/api/documents/${documentId}/view`
      });
    } else {
      // Fallback: copy to clipboard
      const url = `${window.location.origin}/api/documents/${documentId}/view`;
      navigator.clipboard.writeText(url).then(() => {
        // Show temporary notification
        this.showNotification('Document link copied to clipboard!');
      });
    }
  }

  /**
   * Show temporary notification
   */
  showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = 'chat-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #48bb78;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 1000;
      animation: slideInRight 0.3s ease-out;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  /**
   * Format date for display
   */
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

  /**
   * Cleanup components
   */
  cleanup() {
    this.componentRegistry.clear();
  }
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
  @keyframes slideInRight {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOutRight {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Initialize components manager
document.addEventListener('DOMContentLoaded', () => {
  window.chatComponents = new ChatComponentsManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatComponentsManager;
}

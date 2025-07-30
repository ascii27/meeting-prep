/**
 * Daily Briefing Frontend Functionality
 * Handles briefing generation, progress tracking, and display
 */

class DailyBriefingManager {
  constructor() {
    this.currentEventSource = null;
    this.isGenerating = false;
    this.init();
  }

  init() {
    this.attachEventListeners();
    this.checkExistingBriefings();
  }

  attachEventListeners() {
    // Generate briefing buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('generate-briefing-btn')) {
        const briefingSection = e.target.closest('.briefing-section');
        const date = briefingSection ? briefingSection.dataset.date : null;
        if (date) {
          this.generateBriefing(date);
        }
      }
      
      if (e.target.classList.contains('view-briefing-btn')) {
        console.log('👁️ View briefing button clicked!', e.target);
        const briefingSection = e.target.closest('.briefing-section');
        console.log('📁 Found briefing section:', briefingSection);
        const date = briefingSection ? briefingSection.dataset.date : null;
        console.log('📅 Extracted date:', date);
        if (date) {
          console.log('🚀 Calling viewBriefing with date:', date);
          this.viewBriefing(date);
        } else {
          console.error('❌ No date found for view briefing button');
        }
      }
      
      if (e.target.classList.contains('delete-briefing-btn')) {
        const briefingSection = e.target.closest('.briefing-section');
        const date = briefingSection ? briefingSection.dataset.date : null;
        if (date) {
          this.deleteBriefing(date);
        }
      }
    });
  }

  async checkExistingBriefings() {
    try {
      // Check for existing briefings for visible dates
      const briefingSections = document.querySelectorAll('.briefing-section');
      
      for (const section of briefingSections) {
        const date = section.dataset.date;
        if (date) {
          await this.updateBriefingStatus(date);
        }
      }
    } catch (error) {
      console.error('Error checking existing briefings:', error);
    }
  }

  async updateBriefingStatus(date) {
    try {
      const response = await fetch(`/api/daily-briefing/${date}`);
      const briefingSection = document.querySelector(`.briefing-section[data-date="${date}"]`);
      
      if (!briefingSection) return;

      if (response.ok) {
        const { briefing } = await response.json();
        this.updateSectionWithBriefing(briefingSection, briefing);
      } else if (response.status === 404) {
        this.updateSectionWithoutBriefing(briefingSection, date);
      }
    } catch (error) {
      console.error(`Error checking briefing status for ${date}:`, error);
      this.updateSectionWithoutBriefing(briefingSection, date);
    }
  }

  updateSectionWithBriefing(briefingSection, briefing) {
    
    if (briefing.status === 'completed') {
      briefingSection.innerHTML = `
        <div class="briefing-completed">
          <i class="fas fa-check-circle text-success"></i>
          <span>Daily briefing ready</span>
          <div class="briefing-actions">
            <button class="btn btn-sm btn-outline-primary view-briefing-btn">
              <i class="fas fa-eye"></i> View
            </button>
            <button class="btn btn-sm btn-outline-danger delete-briefing-btn">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      `;
    } else if (briefing.status === 'processing') {
      briefingSection.innerHTML = `
        <div class="briefing-processing">
          <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
          <span>Generating briefing...</span>
        </div>
      `;
    } else if (briefing.status === 'failed') {
      briefingSection.innerHTML = `
        <div class="briefing-failed">
          <i class="fas fa-exclamation-triangle text-warning"></i>
          <span>Generation failed</span>
          <button class="btn btn-sm btn-outline-primary generate-briefing-btn">
            <i class="fas fa-redo"></i> Retry
          </button>
        </div>
      `;
    }
  }

  updateSectionWithoutBriefing(briefingSection, date) {
    briefingSection.innerHTML = `
      <div class="briefing-generate">
        <button class="btn btn-sm btn-primary generate-briefing-btn">
          <i class="fas fa-magic"></i> Generate Daily Briefing
        </button>
      </div>
    `;
  }

  async generateBriefing(date) {
    if (this.isGenerating) {
      alert('A briefing is already being generated. Please wait.');
      return;
    }

    this.isGenerating = true;
    const briefingSection = document.querySelector(`.briefing-section[data-date="${date}"]`);
    
    try {
      // Update UI to show generation in progress
      this.showGenerationProgress(briefingSection, date);
      
      // Use fetch for POST request with SSE response
      const response = await fetch('/api/daily-briefing/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to start briefing generation: ${errorText}`);
      }

      // Handle Server-Sent Events
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              this.handleProgressUpdate(briefingSection, data);
            } catch (e) {
              console.error('Error parsing SSE data:', e);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error generating briefing:', error);
      this.showGenerationError(briefingSection, date, error.message);
    } finally {
      this.isGenerating = false;
    }
  }

  showGenerationProgress(briefingSection, date) {
    
    briefingSection.innerHTML = `
      <div class="briefing-generating">
        <div class="progress mb-2">
          <div class="progress-bar progress-bar-striped progress-bar-animated" 
               role="progressbar" style="width: 0%"></div>
        </div>
        <div class="generation-status">
          <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
          <span class="status-text">Starting briefing generation...</span>
        </div>
        <button class="btn btn-sm btn-outline-secondary mt-2" onclick="dailyBriefingManager.cancelGeneration()">
          Cancel
        </button>
      </div>
    `;
  }

  handleProgressUpdate(briefingSection, data) {
    const progressBar = briefingSection.querySelector('.progress-bar');
    const statusText = briefingSection.querySelector('.status-text');
    
    if (!progressBar || !statusText) return;

    if (data.step === 'completed' && data.briefing) {
      // Generation completed successfully
      this.updateSectionWithBriefing(briefingSection, data.briefing);
      this.showSuccessMessage('Daily briefing generated successfully!');
    } else if (data.step === 'error') {
      // Generation failed
      this.showGenerationError(briefingSection, briefingSection.dataset.date, data.error);
    } else {
      // Update progress
      if (data.progress !== undefined) {
        progressBar.style.width = `${data.progress}%`;
      }
      
      // Update status text based on step
      const statusMessages = {
        'fetching_meetings': 'Fetching calendar events...',
        'processing_meetings': 'Processing meetings...',
        'processing_meeting': data.meetingTitle ? 
          `Processing: ${data.meetingTitle} (${data.meetingIndex}/${data.totalMeetings})` : 
          'Processing meetings...',
        'generating_briefing': 'Generating comprehensive briefing...',
        'finalizing': 'Finalizing briefing...'
      };
      
      if (statusMessages[data.step]) {
        statusText.textContent = statusMessages[data.step];
      }
    }
  }

  showGenerationError(briefingSection, date, errorMessage) {
    briefingSection.innerHTML = `
      <div class="briefing-error">
        <div class="alert alert-danger">
          <i class="fas fa-exclamation-triangle"></i>
          <strong>Generation Failed:</strong> ${errorMessage}
        </div>
        <button class="btn btn-sm btn-primary generate-briefing-btn">
          <i class="fas fa-redo"></i> Try Again
        </button>
      </div>
    `;
  }

  cancelGeneration() {
    this.isGenerating = false;
    this.showSuccessMessage('Briefing generation cancelled.');
    this.checkExistingBriefings(); // Refresh status
  }

  async viewBriefing(date) {
    console.log('🔍 viewBriefing called with date:', date);
    
    try {
      console.log('📡 Fetching briefing from API:', `/api/daily-briefing/${date}`);
      const response = await fetch(`/api/daily-briefing/${date}`);
      
      console.log('📡 API Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        console.error('❌ API response not ok:', response.status, response.statusText);
        throw new Error(`Failed to load briefing: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      console.log('📄 API Response data:', responseData);
      
      const { briefing } = responseData;
      console.log('📋 Extracted briefing object:', briefing);
      
      if (!briefing) {
        console.error('❌ No briefing object in response');
        throw new Error('No briefing data received');
      }
      
      console.log('🎭 Calling showBriefingModal with briefing');
      this.showBriefingModal(briefing);
      
    } catch (error) {
      console.error('❌ Error viewing briefing:', error);
      alert('Failed to load briefing. Please try again.');
    }
  }

  showBriefingModal(briefing) {
    console.log('🎭 showBriefingModal called with briefing:', briefing);
    
    const modal = document.createElement('div');
    modal.className = 'custom-modal-overlay';
    console.log('📦 Created modal element with class:', modal.className);
    
    // Parse JSON strings if they exist
    let peopleOverview = null;
    let priorityPreparations = null;
    
    console.log('🔍 Parsing peopleOverview:', briefing.peopleOverview, 'Type:', typeof briefing.peopleOverview);
    try {
      if (briefing.peopleOverview && typeof briefing.peopleOverview === 'string') {
        // Try JSON parse first, if that fails, treat as comma-separated string
        try {
          peopleOverview = JSON.parse(briefing.peopleOverview);
          console.log('✅ Parsed peopleOverview as JSON:', peopleOverview);
        } catch (jsonError) {
          // Handle comma-separated string format
          peopleOverview = briefing.peopleOverview.split(',').map(item => item.trim()).filter(item => item);
          console.log('✅ Parsed peopleOverview as comma-separated string:', peopleOverview);
        }
      } else if (Array.isArray(briefing.peopleOverview)) {
        peopleOverview = briefing.peopleOverview;
        console.log('✅ Using peopleOverview as array:', peopleOverview);
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse peopleOverview:', e);
    }
    
    console.log('🔍 Parsing priorityPreparations:', briefing.priorityPreparations, 'Type:', typeof briefing.priorityPreparations);
    try {
      if (briefing.priorityPreparations && typeof briefing.priorityPreparations === 'string') {
        // Try JSON parse first, if that fails, treat as comma-separated string
        try {
          priorityPreparations = JSON.parse(briefing.priorityPreparations);
          console.log('✅ Parsed priorityPreparations as JSON:', priorityPreparations);
        } catch (jsonError) {
          // Handle comma-separated string or single string format
          if (briefing.priorityPreparations.includes(',')) {
            priorityPreparations = briefing.priorityPreparations.split(',').map(item => item.trim()).filter(item => item);
          } else {
            priorityPreparations = [briefing.priorityPreparations.trim()];
          }
          console.log('✅ Parsed priorityPreparations as string:', priorityPreparations);
        }
      } else if (Array.isArray(briefing.priorityPreparations)) {
        priorityPreparations = briefing.priorityPreparations;
        console.log('✅ Using priorityPreparations as array:', priorityPreparations);
      }
    } catch (e) {
      console.warn('⚠️ Failed to parse priorityPreparations:', e);
    }
    
    modal.innerHTML = `
        <div class="custom-modal-dialog">
          <div class="custom-modal-content">
            <div class="custom-modal-header">
              <h3 class="custom-modal-title">
                <i class="fas fa-calendar-day"></i>
                Daily Briefing - ${new Date(briefing.briefingDate).toLocaleDateString()}
              </h3>
              <button type="button" class="custom-modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="custom-modal-body">
              <div class="briefing-content">
                ${briefing.summaryHtml || '<p>No content available</p>'}
              </div>
              
              ${peopleOverview && Array.isArray(peopleOverview) && peopleOverview.length > 0 ? `
                <div class="people-overview">
                  <h4><i class="fas fa-users"></i> Key People</h4>
                  <div class="people-list">
                    ${peopleOverview.map(person => `
                      <span class="person-badge">${person}</span>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
              
              ${priorityPreparations && Array.isArray(priorityPreparations) && priorityPreparations.length > 0 ? `
                <div class="priority-preparations">
                  <h4><i class="fas fa-star"></i> Priority Preparations</h4>
                  <ul class="preparations-list">
                    ${priorityPreparations.map(prep => `
                      <li>${prep}</li>
                    `).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
            <div class="custom-modal-footer">
              <button type="button" class="btn btn-secondary close-modal">Close</button>
              <button type="button" class="btn btn-danger delete-briefing-btn" data-date="${briefing.briefingDate}">
                <i class="fas fa-trash"></i> Delete
              </button>
            </div>
          </div>
        </div>
    `;
    
    console.log('📝 Generated modal HTML length:', modal.innerHTML.length);
    console.log('📝 Modal HTML preview:', modal.innerHTML.substring(0, 200) + '...');
    
    console.log('📦 Appending modal to document.body');
    document.body.appendChild(modal);
    
    console.log('🔍 Modal appended, checking if it exists in DOM:', document.body.contains(modal));
    console.log('🔍 Modal element:', modal);
    
    // Show modal with animation
    console.log('⏰ Setting timeout to show modal with animation');
    setTimeout(() => {
      console.log('🎬 Adding "show" class to modal');
      modal.classList.add('show');
      console.log('🎬 Modal classes after adding show:', modal.className);
    }, 10);
    
    // Close modal handlers
    const closeModal = () => {
      console.log('🚪 Closing modal');
      modal.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(modal)) {
          console.log('🗑️ Removing modal from DOM');
          document.body.removeChild(modal);
        }
      }, 300);
    };
    
    console.log('🔗 Setting up event handlers');
    
    const closeBtn = modal.querySelector('.custom-modal-close');
    const closeModalBtn = modal.querySelector('.close-modal');
    
    console.log('🔗 Found close button:', closeBtn);
    console.log('🔗 Found close modal button:', closeModalBtn);
    console.log('🔗 Modal overlay element (main modal):', modal);
    
    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
      console.log('✅ Added click handler to close button');
    } else {
      console.error('❌ Close button not found!');
    }
    
    if (closeModalBtn) {
      closeModalBtn.addEventListener('click', closeModal);
      console.log('✅ Added click handler to close modal button');
    } else {
      console.error('❌ Close modal button not found!');
    }
    // Click outside modal to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        console.log('🚪 Overlay clicked, closing modal');
        closeModal();
      }
    });
    
    console.log('✅ Added overlay click handler to main modal element');
    
    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }
  
  hideModal() {
    const modal = document.querySelector('.custom-modal-overlay.show');
    if (modal) {
      console.log('🚪 hideModal called, removing modal');
      modal.classList.remove('show');
      setTimeout(() => {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
          console.log('🗑️ Modal removed from DOM');
        }
      }, 300);
    }
  }

  async deleteBriefing(date) {
    if (!confirm('Are you sure you want to delete this daily briefing?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/daily-briefing/${date}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete briefing');
      }
      
      // Update UI
      await this.updateBriefingStatus(date);
      this.showSuccessMessage('Daily briefing deleted successfully.');
      
      // Close custom modal if open
      const modal = document.querySelector('.custom-modal-overlay.show');
      if (modal) {
        this.hideModal();
      }
      
    } catch (error) {
      console.error('Error deleting briefing:', error);
      alert('Failed to delete briefing. Please try again.');
    }
  }

  showSuccessMessage(message) {
    // Create custom toast notification
    const toast = document.createElement('div');
    toast.className = 'custom-toast custom-toast-success';
    toast.innerHTML = `
      <div class="custom-toast-content">
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
        <button type="button" class="custom-toast-close">&times;</button>
      </div>
    `;
    
    // Add to toast container or create one
    let toastContainer = document.querySelector('.custom-toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'custom-toast-container';
      document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    
    // Show toast with animation
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);
    
    // Add close button handler
    const closeBtn = toast.querySelector('.custom-toast-close');
    closeBtn.addEventListener('click', () => {
      this.hideToast(toast, toastContainer);
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      this.hideToast(toast, toastContainer);
    }, 5000);
  }
  
  hideToast(toast, container) {
    toast.classList.remove('show');
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dailyBriefingManager = new DailyBriefingManager();
});

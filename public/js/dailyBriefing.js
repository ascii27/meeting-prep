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
        const briefingSection = e.target.closest('.briefing-section');
        const date = briefingSection ? briefingSection.dataset.date : null;
        if (date) {
          this.viewBriefing(date);
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
              <i class="fas fa-trash"></i>
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
      
      // Start Server-Sent Events connection
      this.currentEventSource = new EventSource('/api/daily-briefing/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date })
      });

      // Use fetch for POST request with SSE response
      const response = await fetch('/api/daily-briefing/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date })
      });

      if (!response.ok) {
        throw new Error('Failed to start briefing generation');
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
      if (this.currentEventSource) {
        this.currentEventSource.close();
        this.currentEventSource = null;
      }
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
    if (this.currentEventSource) {
      this.currentEventSource.close();
      this.currentEventSource = null;
    }
    this.isGenerating = false;
    this.showSuccessMessage('Briefing generation cancelled.');
    this.checkExistingBriefings(); // Refresh status
  }

  async viewBriefing(date) {
    try {
      const response = await fetch(`/api/daily-briefing/${date}`);
      
      if (!response.ok) {
        throw new Error('Failed to load briefing');
      }
      
      const { briefing } = await response.json();
      this.showBriefingModal(briefing);
      
    } catch (error) {
      console.error('Error viewing briefing:', error);
      alert('Failed to load briefing. Please try again.');
    }
  }

  showBriefingModal(briefing) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="fas fa-calendar-day"></i>
              Daily Briefing - ${new Date(briefing.briefingDate).toLocaleDateString()}
            </h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="briefing-content">
              ${briefing.summaryHtml || '<p>No content available</p>'}
            </div>
            
            ${briefing.peopleOverview ? `
              <div class="people-overview mt-4">
                <h6><i class="fas fa-users"></i> Key People</h6>
                <div class="people-list">
                  ${briefing.peopleOverview.map(person => `
                    <span class="badge bg-secondary me-2">${person}</span>
                  `).join('')}
                </div>
              </div>
            ` : ''}
            
            ${briefing.priorityPreparations ? `
              <div class="priority-preparations mt-4">
                <h6><i class="fas fa-star"></i> Priority Preparations</h6>
                <ul class="list-group list-group-flush">
                  ${briefing.priorityPreparations.map(prep => `
                    <li class="list-group-item">${prep}</li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-outline-danger delete-briefing-btn" data-date="${briefing.briefingDate}">
              <i class="fas fa-trash"></i> Delete
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
    
    // Clean up modal when hidden
    modal.addEventListener('hidden.bs.modal', () => {
      document.body.removeChild(modal);
    });
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
      
      // Close modal if open
      const modal = document.querySelector('.modal.show');
      if (modal) {
        bootstrap.Modal.getInstance(modal).hide();
      }
      
    } catch (error) {
      console.error('Error deleting briefing:', error);
      alert('Failed to delete briefing. Please try again.');
    }
  }

  showSuccessMessage(message) {
    // Create toast notification
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-white bg-success border-0';
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body">
          <i class="fas fa-check-circle me-2"></i>
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    `;
    
    // Add to toast container or create one
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
      document.body.appendChild(toastContainer);
    }
    
    toastContainer.appendChild(toast);
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
    
    // Clean up after toast is hidden
    toast.addEventListener('hidden.bs.toast', () => {
      toastContainer.removeChild(toast);
    });
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.dailyBriefingManager = new DailyBriefingManager();
});

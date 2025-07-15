/**
 * Meeting Preparation JavaScript
 * Handles client-side functionality for AI-powered meeting preparation
 */

// Track current meeting ID for preparation
let currentMeetingId = null;

/**
 * Fetch preparation materials for a meeting
 * @param {string} meetingId - Meeting ID
 * @param {HTMLElement} container - Container to display preparation materials
 */
async function fetchPreparationMaterials(meetingId, container) {
  try {
    // Show loading state
    container.innerHTML = '<div class="loading-spinner">Loading preparation materials...</div>';
    
    // Set current meeting ID
    currentMeetingId = meetingId;
    
    // Fetch preparation materials
    const response = await fetch(`/api/preparation/${meetingId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch preparation materials');
    }
    
    const data = await response.json();
    
    // Display preparation materials
    displayPreparationMaterials(data, container);
  } catch (error) {
    console.error('Error fetching preparation materials:', error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to load preparation materials.</p>
        <button class="retry-button" onclick="fetchPreparationMaterials('${meetingId}', this.parentElement.parentElement)">
          Retry
        </button>
      </div>
    `;
  }
}

/**
 * Display preparation materials in the container
 * @param {Object} data - Preparation data
 * @param {HTMLElement} container - Container to display preparation materials
 */
function displayPreparationMaterials(data, container) {
  // Clear the container
  container.innerHTML = '';
  
  // Create preparation container
  const prepContainer = document.createElement('div');
  prepContainer.className = 'preparation-container';
  
  // Add summary section
  const summarySection = document.createElement('div');
  summarySection.className = 'prep-section summary-section';
  summarySection.innerHTML = `
    <h3>Meeting Summary</h3>
    <div class="summary-content">${data.summary}</div>
  `;
  
  // Add topics section
  const topicsSection = document.createElement('div');
  topicsSection.className = 'prep-section topics-section';
  topicsSection.innerHTML = `
    <h3>Key Topics</h3>
    <ul class="topics-list">
      ${data.topics.map(topic => `<li>${topic}</li>`).join('')}
    </ul>
  `;
  
  // Add suggestions section
  const suggestionsSection = document.createElement('div');
  suggestionsSection.className = 'prep-section suggestions-section';
  suggestionsSection.innerHTML = `
    <h3>Preparation Suggestions</h3>
    <ul class="suggestions-list">
      ${data.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
    </ul>
  `;
  
  // Add documents section
  const documentsSection = document.createElement('div');
  documentsSection.className = 'prep-section documents-section';
  documentsSection.innerHTML = `
    <h3>Related Documents</h3>
    <ul class="documents-list">
      ${data.documents.map(doc => `<li>${doc.title}</li>`).join('')}
    </ul>
  `;
  
  // Add notes section
  const notesSection = document.createElement('div');
  notesSection.className = 'prep-section notes-section';
  notesSection.innerHTML = `
    <h3>Your Notes</h3>
    <textarea id="meeting-notes" class="meeting-notes" placeholder="Add your notes here...">${data.userNotes || ''}</textarea>
    <button id="save-notes-btn" class="save-notes-btn">Save Notes</button>
  `;
  
  // Add refresh button
  const refreshSection = document.createElement('div');
  refreshSection.className = 'prep-section refresh-section';
  refreshSection.innerHTML = `
    <button id="refresh-prep-btn" class="refresh-prep-btn">Refresh Analysis</button>
  `;
  
  // Append all sections to the preparation container
  prepContainer.appendChild(summarySection);
  prepContainer.appendChild(topicsSection);
  prepContainer.appendChild(suggestionsSection);
  prepContainer.appendChild(documentsSection);
  prepContainer.appendChild(notesSection);
  prepContainer.appendChild(refreshSection);
  
  // Append the preparation container to the main container
  container.appendChild(prepContainer);
  
  // Add event listeners
  setupPreparationEventListeners();
}

/**
 * Set up event listeners for preparation UI
 */
function setupPreparationEventListeners() {
  // Save notes button
  const saveNotesBtn = document.getElementById('save-notes-btn');
  if (saveNotesBtn) {
    saveNotesBtn.addEventListener('click', saveUserNotes);
  }
  
  // Refresh analysis button
  const refreshPrepBtn = document.getElementById('refresh-prep-btn');
  if (refreshPrepBtn) {
    refreshPrepBtn.addEventListener('click', refreshPreparationAnalysis);
  }
}

/**
 * Save user notes for the current meeting
 */
async function saveUserNotes() {
  if (!currentMeetingId) return;
  
  try {
    const notesTextarea = document.getElementById('meeting-notes');
    const notes = notesTextarea.value;
    
    const response = await fetch(`/api/preparation/${currentMeetingId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ notes })
    });
    
    if (!response.ok) {
      throw new Error('Failed to save notes');
    }
    
    // Show success message
    const saveBtn = document.getElementById('save-notes-btn');
    const originalText = saveBtn.textContent;
    saveBtn.textContent = 'Saved!';
    saveBtn.disabled = true;
    
    // Reset button after 2 seconds
    setTimeout(() => {
      saveBtn.textContent = originalText;
      saveBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('Error saving notes:', error);
    alert('Failed to save notes. Please try again.');
  }
}

/**
 * Refresh preparation analysis for the current meeting
 */
async function refreshPreparationAnalysis() {
  if (!currentMeetingId) return;
  
  try {
    // Get the preparation container
    const prepContainer = document.querySelector('.preparation-container');
    if (!prepContainer) return;
    
    const container = prepContainer.parentElement;
    
    // Show loading state
    container.innerHTML = '<div class="loading-spinner">Refreshing analysis...</div>';
    
    // Trigger re-analysis
    const response = await fetch(`/api/preparation/${currentMeetingId}/analyze`, {
      method: 'POST'
    });
    
    if (!response.ok) {
      throw new Error('Failed to refresh analysis');
    }
    
    const data = await response.json();
    
    // Display updated preparation materials
    displayPreparationMaterials(data, container);
  } catch (error) {
    console.error('Error refreshing analysis:', error);
    alert('Failed to refresh analysis. Please try again.');
  }
}

// Export functions for use in other scripts
window.fetchPreparationMaterials = fetchPreparationMaterials;

/**
 * Meeting Preparation JavaScript
 * Handles client-side functionality for AI-powered meeting preparation
 */

// Track current meeting ID for preparation
let currentMeetingId = null;

/**
 * Initialize the preparation section with a button to generate analysis
 * @param {string} meetingId - Meeting ID
 * @param {HTMLElement} container - Container to display preparation materials
 */
async function initializePreparationSection(meetingId, container) {
  console.log(`[Client] Initializing preparation section for meeting: ${meetingId}`);
  try {
    // Set current meeting ID
    currentMeetingId = meetingId;
    
    // Check if preparation materials already exist (cached)
    console.log(`[Client] Checking if preparation materials exist for meeting: ${meetingId}`);
    const response = await fetch(`/api/preparation/${meetingId}/status`);
    
    if (!response.ok) {
      throw new Error('Failed to check preparation status');
    }
    
    const data = await response.json();
    
    if (data.exists) {
      // If materials exist, fetch and display them
      console.log(`[Client] Preparation materials exist for meeting: ${meetingId}, fetching them`);
      fetchPreparationMaterials(meetingId, container);
    } else {
      // If no materials exist, show the generate button
      console.log(`[Client] No preparation materials exist for meeting: ${meetingId}, showing generate button`);
      container.innerHTML = `
        <div class="preparation-placeholder">
          <p>No AI analysis has been generated for this meeting yet.</p>
          <button class="generate-analysis-button" onclick="refreshPreparationAnalysis('${meetingId}', this.parentElement.parentElement)">
            Generate Analysis
          </button>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error initializing preparation section:', error);
    container.innerHTML = `
      <div class="preparation-placeholder">
        <p>Ready to analyze this meeting with AI.</p>
        <button class="generate-analysis-button" onclick="refreshPreparationAnalysis('${meetingId}', this.parentElement.parentElement)">
          Generate Analysis
        </button>
      </div>
    `;
  }
}

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
        <button class="generate-analysis-button" onclick="refreshPreparationAnalysis('${meetingId}', this.parentElement.parentElement)">
          Generate New Analysis
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
  
  // Create the header
  const summaryHeader = document.createElement('h3');
  summaryHeader.textContent = 'Meeting Summary';
  summarySection.appendChild(summaryHeader);
  
  // Create the content container
  const summaryContent = document.createElement('div');
  summaryContent.className = 'summary-content';
  
  // Set the HTML content (already sanitized by marked library on the server)
  summaryContent.innerHTML = data.summary;
  
  // Add the content to the section
  summarySection.appendChild(summaryContent);
  
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
 * Refresh preparation analysis for a meeting
 * @param {string} meetingId - Meeting ID (optional, uses currentMeetingId if not provided)
 * @param {HTMLElement} container - Container to display preparation materials (optional)
 */
async function refreshPreparationAnalysis(meetingId, container) {
  // Use provided meetingId or fall back to currentMeetingId
  const targetMeetingId = meetingId || currentMeetingId;
  console.log(`[Client] refreshPreparationAnalysis called for meeting: ${targetMeetingId}`);
  if (!targetMeetingId) {
    console.error('[Client] No meeting ID provided for analysis');
    return;
  }
  
  try {
    // If container is not provided, try to find it
    if (!container) {
      const prepContainer = document.querySelector('.preparation-container');
      if (!prepContainer) return;
      container = prepContainer.parentElement;
    }
    
    // Update current meeting ID
    currentMeetingId = targetMeetingId;
    
    // Show loading state
    container.innerHTML = '<div class="loading-spinner">Generating AI analysis...</div>';
    
    // Trigger analysis
    console.log(`[Client] Sending POST request to /api/preparation/${targetMeetingId}/analyze`);
    const response = await fetch(`/api/preparation/${targetMeetingId}/analyze`, {
      method: 'POST'
    });
    console.log(`[Client] Received response from analyze endpoint:`, response.status);
    
    if (!response.ok) {
      console.error(`[Client] Error response from server: ${response.status}`);
      throw new Error(`Failed to generate analysis: ${response.status} ${response.statusText}`);
    }
    
    console.log('[Client] Successfully received analysis data from server');
    const data = await response.json();
    console.log('[Client] Analysis data:', data);
    
    // Display updated preparation materials
    displayPreparationMaterials(data, container);
  } catch (error) {
    console.error('Error generating analysis:', error);
    container.innerHTML = `
      <div class="error-message">
        <p>Failed to generate analysis: ${error.message}</p>
        <button class="generate-analysis-button" onclick="refreshPreparationAnalysis('${targetMeetingId}', this.parentElement.parentElement)">
          Try Again
        </button>
      </div>
    `;
  }
}

// Export functions for use in other scripts
window.fetchPreparationMaterials = fetchPreparationMaterials;
window.initializePreparationSection = initializePreparationSection;
window.refreshPreparationAnalysis = refreshPreparationAnalysis;

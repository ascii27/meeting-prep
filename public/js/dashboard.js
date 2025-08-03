/**
 * Dashboard JavaScript
 * Handles client-side interactions for the dashboard
 */

document.addEventListener('DOMContentLoaded', function() {
  // Week navigation
  setupWeekNavigation();
  
  // Meeting card expansion
  setupMeetingCardExpansion();
});

/**
 * Sets up week navigation (previous/next week)
 */
function setupWeekNavigation() {
  const prevWeekBtn = document.getElementById('prev-week');
  const nextWeekBtn = document.getElementById('next-week');
  const currentWeekText = document.getElementById('current-week-text');
  
  if (prevWeekBtn && nextWeekBtn) {
    prevWeekBtn.addEventListener('click', function() {
      navigateWeek(-1);
    });
    
    nextWeekBtn.addEventListener('click', function() {
      navigateWeek(1);
    });
  }
}

/**
 * Navigates to previous or next week
 * @param {number} direction - Direction to navigate (-1 for previous, 1 for next)
 */
function navigateWeek(direction) {
  // Get the current offset from URL or default to 0
  const urlParams = new URLSearchParams(window.location.search);
  let weekOffset = parseInt(urlParams.get('weekOffset') || '0');
  
  // Update the offset
  weekOffset += direction;
  
  // Redirect to the new URL with updated offset
  window.location.href = `/dashboard?weekOffset=${weekOffset}`;
}

/**
 * Fetches documents for a specific event
 * @param {string} eventId - ID of the event
 * @param {HTMLElement} container - Container to display documents
 */
async function fetchDocumentsForEvent(eventId, container) {
  try {
    // Show loading state
    container.innerHTML = '<p>Loading documents...</p>';
    
    // Fetch documents from API
    const response = await fetch(`/api/documents/events/${eventId}/documents`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to fetch documents');
    }
    
    // Display documents
    if (result.data && result.data.length > 0) {
      displayDocuments(result.data, container);
    } else {
      container.innerHTML = '<p>No documents found for this meeting.</p>';
    }
  } catch (error) {
    console.error('Error fetching documents:', error);
    container.innerHTML = `<p class="error">Error loading documents: ${error.message}</p>`;
  }
}

/**
 * Displays documents in the container
 * @param {Array} documents - Array of document objects
 * @param {HTMLElement} container - Container to display documents
 */
function displayDocuments(documents, container) {
  // Clear the container
  container.innerHTML = '';
  
  // Create document list
  const docList = document.createElement('ul');
  docList.className = 'document-list';
  
  documents.forEach(doc => {
    const docItem = document.createElement('li');
    docItem.className = 'document-item';
    
    const docLink = document.createElement('a');
    docLink.href = doc.url || '#';
    docLink.textContent = doc.title;
    docLink.setAttribute('data-doc-id', doc.id);
    docLink.target = '_blank';
    docLink.rel = 'noopener noreferrer';
    
    // If no URL is available, fall back to showing content inline
    if (!doc.url) {
      docLink.addEventListener('click', function(e) {
        e.preventDefault();
        fetchDocumentContent(doc.id, container);
      });
    }
    
    docItem.appendChild(docLink);
    docList.appendChild(docItem);
  });
  
  container.appendChild(docList);
}

/**
 * Fetches and displays content for a specific document
 * @param {string} documentId - ID of the document
 * @param {HTMLElement} container - Container to display document content
 */
async function fetchDocumentContent(documentId, container) {
  try {
    // Show loading state
    container.innerHTML = '<p>Loading document content...</p>';
    
    // Fetch document content from API
    const response = await fetch(`/api/documents/documents/${documentId}`);
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.message || 'Failed to fetch document content');
    }
    
    // Display document content
    displayDocumentContent(result.data, container);
  } catch (error) {
    console.error('Error fetching document content:', error);
    container.innerHTML = `<p class="error">Error loading document content: ${error.message}</p>`;
  }
}

/**
 * Displays document content in the container
 * @param {Object} docData - Document object with title and content
 * @param {HTMLElement} container - Container to display document content
 */
function displayDocumentContent(docData, container) {
  // Clear the container
  container.innerHTML = '';
  
  // Create back button
  const backButton = document.createElement('button');
  backButton.textContent = 'Back to document list';
  backButton.className = 'back-button';
  backButton.addEventListener('click', function() {
    // Get the event ID from the parent meeting card
    const meetingCard = container.closest('.meeting-card');
    const eventId = meetingCard.getAttribute('data-event-id');
    
    // Fetch documents again
    fetchDocumentsForEvent(eventId, container);
  });
  
  // Create document content container
  const docContainer = document.createElement('div');
  docContainer.className = 'document-content';
  
  // Add document title
  const docTitle = document.createElement('h3');
  docTitle.textContent = docData.title;
  
  // Add document content
  const docContent = document.createElement('div');
  docContent.className = 'document-text';
  docContent.textContent = docData.content;
  
  // Append elements
  docContainer.appendChild(docTitle);
  docContainer.appendChild(docContent);
  
  container.appendChild(backButton);
  container.appendChild(docContainer);
}

/**
 * Sets up meeting card expansion for viewing details
 */
function setupMeetingCardExpansion() {
  const meetingCards = document.querySelectorAll('.meeting-card');
  
  meetingCards.forEach(card => {
    // Get the main card sections that should trigger expansion/collapse
    const cardHeader = card.querySelector('.meeting-time');
    const cardMainDetails = card.querySelector('.meeting-details');
    const cardStatus = card.querySelector('.meeting-status');
    
    // These are the elements that should trigger the expand/collapse
    const triggerElements = [cardHeader, cardMainDetails, cardStatus];
    
    // Add click handlers to the trigger elements only
    triggerElements.forEach(element => {
      if (element) {
        element.addEventListener('click', function(event) {
          // Get the parent card
          const parentCard = this.closest('.meeting-card');
          
          // Toggle expanded class
          parentCard.classList.toggle('expanded');
          
          // Find expanded details section
          const expandedDetailsSection = parentCard.querySelector('.meeting-expanded-details');
          const documentsSection = parentCard.querySelector('.meeting-documents');
          const preparationSection = parentCard.querySelector('.preparation-section');
          const eventId = parentCard.getAttribute('data-event-id');
          
          if (expandedDetailsSection) {
            if (parentCard.classList.contains('expanded')) {
              // Show the expanded details
              expandedDetailsSection.style.display = 'block';
              
              // Fetch documents for this event when expanded
              if (eventId && documentsSection) {
                fetchDocumentsForEvent(eventId, documentsSection);
              }
              
              // Initialize preparation section with a button to generate analysis
              if (eventId && preparationSection && typeof initializePreparationSection === 'function') {
                initializePreparationSection(eventId, preparationSection);
              }
            } else {
              // Hide the expanded details
              expandedDetailsSection.style.display = 'none';
            }
          }
        });
      }
    });
    
    // Get the expanded details section
    const expandedDetailsSection = card.querySelector('.meeting-expanded-details');
    
    if (expandedDetailsSection) {
      // Prevent clicks inside the expanded details from bubbling up to the card
      expandedDetailsSection.addEventListener('click', function(event) {
        // Stop the event from reaching the card
        event.stopPropagation();
      });
    }
  });
}

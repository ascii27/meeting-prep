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
 * Sets up meeting card expansion for viewing details
 */
function setupMeetingCardExpansion() {
  const meetingCards = document.querySelectorAll('.meeting-card');
  
  meetingCards.forEach(card => {
    card.addEventListener('click', function(e) {
      // Don't expand if clicking on a link
      if (e.target.tagName === 'A') {
        return;
      }
      
      // Toggle expanded class
      this.classList.toggle('expanded');
      
      // Get the meeting details section
      const detailsSection = this.querySelector('.meeting-expanded-details');
      
      if (detailsSection) {
        if (this.classList.contains('expanded')) {
          detailsSection.style.display = 'block';
        } else {
          detailsSection.style.display = 'none';
        }
      }
    });
  });
}

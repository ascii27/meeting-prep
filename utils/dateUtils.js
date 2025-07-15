/**
 * Date Utility Functions
 * Helper functions for date manipulation and formatting
 */

/**
 * Formats a date according to the specified options
 * @param {Date} date - The date to format
 * @param {Object} options - Formatting options for Intl.DateTimeFormat
 * @returns {string} - Formatted date string
 */
function formatDate(date, options = {}) {
  const defaultOptions = {
    month: 'short',
    day: 'numeric'
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  return new Intl.DateTimeFormat('en-US', mergedOptions).format(date);
}

/**
 * Gets ISO date string that preserves the local date (YYYY-MM-DD)
 * This ensures timezone consistency when using dates as keys
 * @param {Date} date - The date to convert
 * @returns {string} - ISO date string in local timezone (YYYY-MM-DD)
 */
function getLocalISODateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a time from a date object or ISO string
 * @param {Date|string} date - Date object or ISO string
 * @returns {string} - Formatted time string (e.g., "9:30 AM")
 */
function formatTime(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  return dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Formats a date range for display
 * @param {Date|string} start - Start date/time
 * @param {Date|string} end - End date/time
 * @returns {string} - Formatted date range (e.g., "9:30 AM - 10:30 AM")
 */
function formatDateRange(start, end) {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  
  // Check if it's an all-day event
  if (isAllDayEvent(start, end)) {
    return 'All day';
  }
  
  return `${formatTime(startDate)} - ${formatTime(endDate)}`;
}

/**
 * Checks if an event is an all-day event
 * @param {Date|string} start - Start date/time
 * @param {Date|string} end - End date/time
 * @returns {boolean} - True if it's an all-day event
 */
function isAllDayEvent(start, end) {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;
  
  // All-day events typically have:
  // 1. No time component (hours, minutes, seconds are all 0)
  // 2. End date is typically the next day at 00:00:00
  
  const isStartMidnight = startDate.getHours() === 0 && 
                          startDate.getMinutes() === 0 && 
                          startDate.getSeconds() === 0;
                          
  const isEndMidnight = endDate.getHours() === 0 && 
                        endDate.getMinutes() === 0 && 
                        endDate.getSeconds() === 0;
                        
  const diffDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
  
  return isStartMidnight && isEndMidnight && (diffDays >= 1);
}

/**
 * Groups events by day
 * @param {Array} events - Array of calendar events
 * @returns {Object} - Events grouped by day
 */
function groupEventsByDay(events) {
  const groupedEvents = {};
  
  events.forEach(event => {
    const startDate = new Date(event.start);
    const dayKey = getLocalISODateString(startDate); // YYYY-MM-DD
    
    if (!groupedEvents[dayKey]) {
      groupedEvents[dayKey] = {
        date: startDate,
        formattedDate: formatDate(startDate),
        events: []
      };
    }
    
    groupedEvents[dayKey].events.push(event);
  });
  
  return groupedEvents;
}

/**
 * Gets the day names for a specific week (Monday-Friday)
 * @param {number} weekOffset - Number of weeks to offset from current week
 * @returns {Array} - Array of day objects with date and formatted name
 */
function getWeekDays(weekOffset = 0) {
  const now = new Date();
  const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  // Calculate days to Monday (start of week)
  const daysToMonday = currentDay === 0 ? 1 : currentDay === 1 ? 0 : -(currentDay - 1);
  
  const weekDays = [];
  
  // Generate the 5 weekdays (Monday-Friday)
  for (let i = 0; i < 5; i++) {
    const date = new Date(now);
    date.setDate(now.getDate() + daysToMonday + i + (weekOffset * 7));
    
    weekDays.push({
      date,
      formattedDate: formatDate(date),
      dayName: formatDate(date, { weekday: 'long' }),
      dayNumber: date.getDate(),
      month: formatDate(date, { month: 'short' }),
      isoString: getLocalISODateString(date)
    });
  }
  
  return weekDays;
}

/**
 * Gets the formatted date range for a week
 * @param {number} weekOffset - Number of weeks to offset from current week
 * @returns {string} - Formatted date range (e.g., "July 15-19, 2025")
 */
function getWeekDateRangeText(weekOffset = 0) {
  const weekDays = getWeekDays(weekOffset);
  const firstDay = weekDays[0].date;
  const lastDay = weekDays[4].date;
  
  // If same month
  if (firstDay.getMonth() === lastDay.getMonth()) {
    return `${formatDate(firstDay, { month: 'long' })} ${firstDay.getDate()}-${lastDay.getDate()}, ${firstDay.getFullYear()}`;
  } else {
    return `${formatDate(firstDay, { month: 'long' })} ${firstDay.getDate()} - ${formatDate(lastDay, { month: 'long' })} ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
  }
}

module.exports = {
  formatDate,
  formatTime,
  formatDateRange,
  isAllDayEvent,
  groupEventsByDay,
  getWeekDays,
  getWeekDateRangeText,
  getLocalISODateString
};

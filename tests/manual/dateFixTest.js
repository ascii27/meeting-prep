/**
 * Test script to demonstrate a fix for the day of week issue
 */

// Import the date utilities
const { formatDate } = require('../../utils/dateUtils');

// Function to get ISO date string that preserves the local date
function getLocalISODateString(date) {
  // This creates a date string in YYYY-MM-DD format based on local time, not UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Current date information
const now = new Date();
console.log('Current date:', now.toISOString());
console.log('Current date (local):', now.toDateString());

// Compare ISO string methods
console.log('Standard ISO string (UTC-based):', now.toISOString().split('T')[0]);
console.log('Local ISO string (timezone-aware):', getLocalISODateString(now));
console.log('-----------------------------------');

// Test with the week days
const weekDays = [];
const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
const daysToMonday = currentDay === 0 ? 1 : currentDay === 1 ? 0 : -(currentDay - 1);

// Generate the 5 weekdays (Monday-Friday)
for (let i = 0; i < 5; i++) {
  const date = new Date(now);
  date.setDate(now.getDate() + daysToMonday + i);
  
  weekDays.push({
    date,
    formattedDate: formatDate(date),
    dayName: formatDate(date, { weekday: 'long' }),
    dayNumber: date.getDate(),
    month: formatDate(date, { month: 'short' }),
    // Use the local ISO date string instead of the UTC-based one
    isoString: getLocalISODateString(date)
  });
}

// Display the results
weekDays.forEach((day, index) => {
  console.log(`Day ${index}:`, day.date.toDateString(), '(', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.date.getDay()], ')');
  console.log('  ISO String (local):', day.isoString);
  console.log('  Day Name:', day.dayName);
});

/**
 * Test script to diagnose the day of week issue in calendar display
 * This script will help us understand how dates are being calculated and displayed
 */

// Import the date utilities
const { getWeekDays, formatDate, getWeekDateRange } = require('../../utils/dateUtils');
const { getWeekDateRange: calendarGetWeekDateRange } = require('../../services/calendarService');

// Current date information
const now = new Date();
console.log('Current date:', now.toISOString());
console.log('Current day:', now.getDay(), '(', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()], ')');
console.log('Current date (local):', now.toDateString());
console.log('-----------------------------------');

// Test the getWeekDateRange function from calendarService
console.log('Testing getWeekDateRange from calendarService:');
const dateRange = calendarGetWeekDateRange(0);
console.log('Start date:', dateRange.startDate.toISOString(), '(', dateRange.startDate.toDateString(), ')');
console.log('End date:', dateRange.endDate.toISOString(), '(', dateRange.endDate.toDateString(), ')');
console.log('Start day:', dateRange.startDate.getDay(), '(', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateRange.startDate.getDay()], ')');
console.log('-----------------------------------');

// Test the getWeekDays function from dateUtils
console.log('Testing getWeekDays from dateUtils:');
const weekDays = getWeekDays(0);
weekDays.forEach((day, index) => {
  console.log(`Day ${index}:`, day.date.toDateString(), '(', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day.date.getDay()], ')');
  console.log('  ISO String:', day.isoString);
  console.log('  Day Name:', day.dayName);
});
console.log('-----------------------------------');

// Test date calculation logic
console.log('Testing date calculation logic:');
const currentDay = now.getDay();
const daysToMonday = currentDay === 0 ? 1 : currentDay === 1 ? 0 : -(currentDay - 1);
console.log('Current day:', currentDay, '(', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDay], ')');
console.log('Days to Monday:', daysToMonday);

// Calculate Monday's date
const monday = new Date(now);
monday.setDate(now.getDate() + daysToMonday);
console.log('Calculated Monday:', monday.toDateString(), '(', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][monday.getDay()], ')');

// Generate the 5 weekdays (Monday-Friday) manually
console.log('Manually calculating weekdays:');
for (let i = 0; i < 5; i++) {
  const date = new Date(now);
  date.setDate(now.getDate() + daysToMonday + i);
  console.log(`Day ${i}:`, date.toDateString(), '(', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()], ')');
}

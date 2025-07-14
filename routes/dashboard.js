const express = require('express');
const router = express.Router();
const { ensureAuth } = require('../middleware/auth');

// @desc    Dashboard
// @route   GET /dashboard
router.get('/', ensureAuth, (req, res) => {
  // In a real app, we would fetch calendar events here
  // For now, we'll use mock data
  
  // Get current date
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  // Calculate the Monday of current week
  const monday = new Date(today);
  monday.setDate(today.getDate() - currentDay + (currentDay === 0 ? -6 : 1));
  
  // Generate days for the current week (Monday to Friday)
  const weekDays = [];
  for (let i = 0; i < 5; i++) {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    weekDays.push({
      date: day,
      dayName: day.toLocaleDateString('en-US', { weekday: 'long' }),
      formattedDate: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      meetings: [] // Will be populated with real meetings in the future
    });
  }
  
  // Mock meetings data (in a real app, this would come from Google Calendar API)
  const mockMeetings = [
    {
      id: '1',
      title: 'Weekly Team Standup',
      startTime: new Date(weekDays[0].date.setHours(9, 0)),
      endTime: new Date(weekDays[0].date.setHours(9, 30)),
      attendees: ['John Doe', 'Jane Smith', 'Bob Johnson'],
      status: 'ready'
    },
    {
      id: '2',
      title: 'Project Planning',
      startTime: new Date(weekDays[0].date.setHours(14, 0)),
      endTime: new Date(weekDays[0].date.setHours(15, 0)),
      attendees: ['Jane Smith', 'Alice Brown'],
      status: 'not-started'
    },
    {
      id: '3',
      title: 'Client Meeting',
      startTime: new Date(weekDays[1].date.setHours(11, 0)),
      endTime: new Date(weekDays[1].date.setHours(12, 0)),
      attendees: ['John Doe', 'Client A', 'Client B'],
      status: 'in-progress'
    },
    {
      id: '4',
      title: 'Design Review',
      startTime: new Date(weekDays[2].date.setHours(13, 30)),
      endTime: new Date(weekDays[2].date.setHours(14, 30)),
      attendees: ['Design Team', 'Product Manager'],
      status: 'not-started'
    },
    {
      id: '5',
      title: 'Sprint Retrospective',
      startTime: new Date(weekDays[4].date.setHours(16, 0)),
      endTime: new Date(weekDays[4].date.setHours(17, 0)),
      attendees: ['Development Team', 'Scrum Master'],
      status: 'not-started'
    }
  ];
  
  // Assign mock meetings to the appropriate days
  mockMeetings.forEach(meeting => {
    const meetingDay = meeting.startTime.getDay() - 1; // Convert to 0-based index where 0 = Monday
    if (meetingDay >= 0 && meetingDay < 5) { // Only Monday to Friday
      weekDays[meetingDay].meetings.push(meeting);
    }
  });
  
  res.render('dashboard', {
    name: req.user.displayName,
    email: req.user.email,
    profileImage: req.user.image,
    weekDays
  });
});

module.exports = router;

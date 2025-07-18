const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const dotenv = require('dotenv');
const { sequelize, testConnection } = require('./config/database');

// Load environment variables
dotenv.config();

// Debug environment variables
console.log('Google Client ID available:', !!process.env.GOOGLE_CLIENT_ID);
console.log('Google Client Secret available:', !!process.env.GOOGLE_CLIENT_SECRET);

// Initialize Express app
const app = express();

// Configure passport
require('./config/passport')(passport);

// Set up EJS as view engine
app.set('view engine', 'ejs');

// Body parser middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Static folder
app.use(express.static(path.join(__dirname, 'public')));

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  })
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/preparation', require('./routes/preparation'));
app.use('/api/history', require('./routes/history'));

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (dbConnected) {
      console.log('Syncing database models...');
      // Sync all models with the database
      // In production, you might want to use migrations instead of sync
      await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
      console.log('Database synced successfully');
    } else {
      console.warn('Database connection failed, continuing with in-memory storage only');
    }
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

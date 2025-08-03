const app = require('./app');
const { sequelize, testConnection } = require('./config/database');

// Debug environment variables
console.log('Google Client ID available:', !!process.env.GOOGLE_CLIENT_ID);
console.log('Google Client Secret available:', !!process.env.GOOGLE_CLIENT_SECRET);

// 404 handler
app.use((req, res) => {
  res.status(404).render('404');
});

const PORT = process.env.PORT || 3000;

// Check for reset-db command-line argument
const shouldResetDb = process.argv.includes('--reset-db');

// Initialize database and start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    
    if (dbConnected) {
      if (shouldResetDb) {
        console.log('⚠️ RESETTING DATABASE STRUCTURE - This will alter tables to match models');
        await sequelize.sync({ alter: true });
        console.log('✅ Database structure reset successfully');
      } else {
        console.log('Connecting to database without altering structure');
        // Just authenticate without syncing/altering
        await sequelize.authenticate();
        console.log('✅ Database connection established successfully');
      }
    } else {
      console.warn('⚠️ Database connection failed, continuing with in-memory storage only');
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

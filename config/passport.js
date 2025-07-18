const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const userRepository = require('../repositories/userRepository');

// In-memory cache for active users
const activeUsers = {};

module.exports = function(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:3000/auth/google/callback',
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/documents.readonly']
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Create user profile object
          const userProfile = {
            googleId: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : null
          };
          
          // Store tokens for API calls
          const tokens = {
            accessToken,
            refreshToken
          };
          
          // Find or create user in database
          console.log(`Finding or creating user with Google ID: ${profile.id}`);
          const dbUser = await userRepository.findOrCreateFromGoogleProfile(profile);
          
          // Combine database user with tokens for session
          const sessionUser = {
            ...dbUser.dataValues,
            ...tokens
          };
          
          // Cache user in memory for faster access
          activeUsers[profile.id] = sessionUser;
          
          return done(null, sessionUser);
        } catch (error) {
          console.error('Error in Google authentication strategy:', error);
          return done(error, null);
        }
      }
    )
  );

  // Serialize user for the session
  passport.serializeUser((user, done) => {
    done(null, user.googleId);
  });

  // Deserialize user from the session
  passport.deserializeUser(async (id, done) => {
    try {
      // First check memory cache
      if (activeUsers[id]) {
        return done(null, activeUsers[id]);
      }
      
      // If not in cache, check database
      const user = await userRepository.findByGoogleId(id);
      if (!user) {
        return done(new Error('User not found'), null);
      }
      
      // Note: This won't have tokens, but that's ok for most operations
      // User will need to re-authenticate if tokens are needed
      activeUsers[id] = user;
      done(null, user);
    } catch (error) {
      console.error('Error deserializing user:', error);
      done(error, null);
    }
  });
};

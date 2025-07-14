const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

// In a real application, you would store users in a database
const users = {};

module.exports = function(passport) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'http://localhost:3000/auth/google/callback',
        scope: ['profile', 'email', 'https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/documents.readonly']
      },
      (accessToken, refreshToken, profile, done) => {
        // Store user information
        const newUser = {
          googleId: profile.id,
          displayName: profile.displayName,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
          email: profile.emails[0].value,
          image: profile.photos[0].value,
          accessToken,
          refreshToken
        };
        
        // In a real app, you would save this to a database
        users[profile.id] = newUser;
        
        return done(null, newUser);
      }
    )
  );

  // Serialize user for the session
  passport.serializeUser((user, done) => {
    done(null, user.googleId);
  });

  // Deserialize user from the session
  passport.deserializeUser((id, done) => {
    const user = users[id];
    done(null, user);
  });
};

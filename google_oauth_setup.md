# Google OAuth Setup Instructions

To fix the "client isn't configured" error, follow these steps in the Google Cloud Console:

1. Go to https://console.cloud.google.com/
2. Select your project (or create a new one if needed)
3. Navigate to "APIs & Services" > "Credentials"
4. Find your OAuth 2.0 Client ID and click on it to edit
5. Under "Authorized redirect URIs", add:
   ```
   http://localhost:3000/auth/google/callback
   ```
6. Make sure the URI exactly matches what we have in our code
7. Click "Save"
8. Make sure the OAuth consent screen is properly configured:
   - Navigate to "OAuth consent screen"
   - Add your email address as a test user if in testing mode
   - Make sure the required scopes are added (profile, email, calendar.readonly, documents.readonly)

After making these changes, restart your application and try logging in again.

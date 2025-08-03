#!/usr/bin/env node
/**
 * Meeting Intelligence Worker
 * 
 * Standalone script to run the cataloging worker process
 * This allows the worker to run independently from the main server
 */
require('dotenv').config();
const { program } = require('commander');
const { Sequelize } = require('sequelize');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const db = require('../models');
const catalogingWorker = require('../services/intelligence/worker/catalogingWorker');
const graphDatabaseService = require('../services/intelligence/graph/graphDatabaseService');

// Configure command line options
program
  .version('1.0.0')
  .description('Meeting Prep Intelligence Worker - OAuth Authentication')
  .option('--userId <id>', 'Process calendar data for a specific user')
  .option('--all', 'Process calendar data for all users')
  .option('--months <number>', 'Number of months of historical data to process', '6')
  .option('--tokens <path>', 'Path to saved tokens file')
  .option('--save-tokens <path>', 'Save tokens to file after authentication')
  .option('--verbose', 'Enable verbose logging')
  .parse(process.argv);

const options = program.opts();

// Convert months to number
options.months = parseInt(options.months, 10);

// Validate options
if (!options.userId && !options.all) {
  console.error('Error: You must specify either a user ID (--userId) or --all flag');
  process.exit(1);
}

// Set default tokens save path if not specified
if (!options.saveTokens) {
  options.saveTokens = path.join(process.cwd(), 'worker-tokens.json');
}

// Configure logging
const log = {
  info: (message) => {
    console.log(`[${new Date().toISOString()}] INFO: ${message}`);
  },
  warn: (message) => {
    console.log(`[${new Date().toISOString()}] WARNING: ${message}`);
  },
  error: (message) => {
    console.error(`[${new Date().toISOString()}] ERROR: ${message}`);
  },
  debug: (message) => {
    if (options.verbose) {
      console.log(`[${new Date().toISOString()}] DEBUG: ${message}`);
    }
  }
};

// Initialize database connections
async function initializeDbConnections() {
  try {
    // Connect to PostgreSQL
    log.info('Connecting to PostgreSQL database');
    await db.sequelize.authenticate();
    log.info('PostgreSQL database connected successfully');
    
    // Initialize Neo4j
    log.info('Initializing Neo4j connection');
    await graphDatabaseService.initialize();
    log.info('Neo4j initialized successfully');
  } catch (error) {
    log.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
}

// Google OAuth setup for installed application
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/documents.readonly'
];

// Required for local server OAuth flow
const http = require('http');
const url = require('url');
const { exec } = require('child_process');

// Create OAuth2 client for desktop application
function getOAuth2Client() {
  // For desktop applications, we should use the loopback IP with a port
  // that doesn't conflict with the main application
  const PORT = 8085;
  
  const credentials = {
    // Use worker-specific OAuth credentials
    client_id: process.env.WORKER_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.WORKER_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    // Use the loopback IP address for desktop applications
    redirect_uri: `http://localhost:${PORT}`
  };
  
  if (!credentials.client_id || !credentials.client_secret) {
    log.error('Missing Google OAuth credentials. Please check your .env file.');
    log.error('WORKER_GOOGLE_CLIENT_ID and WORKER_GOOGLE_CLIENT_SECRET must be set.');
    log.error('\nTo set up OAuth credentials:');
    log.error('1. Go to https://console.cloud.google.com/apis/credentials');
    log.error('2. Create a new OAuth client ID with "Desktop app" type');
    log.error('3. Add the credentials to your .env file as WORKER_GOOGLE_CLIENT_ID and WORKER_GOOGLE_CLIENT_SECRET');
    process.exit(1);
  }
  
  // Check if using worker-specific or fallback credentials
  if (process.env.WORKER_GOOGLE_CLIENT_ID) {
    log.info(`Using worker-specific client ID: ${credentials.client_id.substring(0, 8)}...`);
  } else {
    log.warn('Using web application client ID as fallback. For better security, set WORKER_GOOGLE_CLIENT_ID and WORKER_GOOGLE_CLIENT_SECRET.');
  }
  
  return new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    credentials.redirect_uri
  );
}

// Get tokens through OAuth flow with local server
async function getTokensInteractively() {
  return new Promise((resolve, reject) => {
    // Create a local server to handle the OAuth callback
    // Use the same PORT as defined in getOAuth2Client
    const server = http.createServer(async (req, res) => {
      try {
        // For desktop apps, the redirect is to the root path with the code as a query parameter
        // No specific path like /oauth2callback is needed

        // Parse the query parameters
        const queryParams = url.parse(req.url, true).query;
        const code = queryParams.code;

        if (!code) {
          res.writeHead(400);
          res.end('Authorization code not found');
          return;
        }

        // Send a success response to the browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <head><title>Authentication Successful</title></head>
            <body>
              <h1>Authentication Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);

        // Get the OAuth2 client and exchange the code for tokens
        const oAuth2Client = getOAuth2Client();
        log.info('Exchanging authorization code for tokens...');
        
        try {
          const { tokens } = await oAuth2Client.getToken(code);
          log.info('Successfully retrieved access token');
          
          // Save tokens to file if specified
          if (options.saveTokens) {
            // Add client credentials to tokens for refresh
            const tokenData = {
              ...tokens,
              client_id: process.env.WORKER_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
              client_secret: process.env.WORKER_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
            };
            fs.writeFileSync(options.saveTokens, JSON.stringify(tokenData));
            log.info(`Tokens saved to ${options.saveTokens}`);
          }
          
          // Close the server and resolve the promise
          server.close(() => {
            resolve(tokens);
          });
        } catch (error) {
          log.error(`Error retrieving access token: ${error.message}`);
          server.close(() => {
            reject(error);
          });
        }
      } catch (error) {
        log.error(`Server error: ${error.message}`);
        res.writeHead(500);
        res.end('Server error');
        server.close(() => {
          reject(error);
        });
      }
    });

    // Get the OAuth2 client to access the PORT constant
    const oAuth2Client = getOAuth2Client();
    // Extract PORT from the redirect_uri
    const PORT = parseInt(oAuth2Client.redirectUri.split(':')[2]);
    
    // Start the server on the configured port
    server.listen(PORT, () => {
      const oAuth2Client = getOAuth2Client();
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent'
      });

      console.log('\n--------------------------------------------------------------');
      console.log('Google OAuth Authentication Required');
      console.log('--------------------------------------------------------------');
      console.log(`1. A local server has started on port ${PORT} to handle the OAuth callback.`);
      console.log('2. Visit this URL in your browser to authorize the application:');
      console.log(authUrl);
      console.log('\n3. After authorizing, you will be automatically redirected to complete the process.');
      
      // Try to open the URL in the default browser
      try {
        if (process.platform === 'darwin') {  // macOS
          exec(`open "${authUrl}"`);
        } else if (process.platform === 'win32') {  // Windows
          exec(`start "" "${authUrl}"`);
        } else {  // Linux and others
          exec(`xdg-open "${authUrl}"`);
        }
      } catch (error) {
        console.log('Failed to open browser automatically. Please open the URL manually.');
      }
    });

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        log.error('Port 8085 is already in use. Please close any other applications using this port and try again.');
      } else {
        log.error(`Server error: ${error.message}`);
      }
      reject(error);
    });
  });
}

// Load tokens from file
function loadTokensFromFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      const tokens = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      log.info(`Loaded tokens from ${filePath}`);
      return tokens;
    }
  } catch (error) {
    log.error(`Error loading tokens from file: ${error.message}`);
  }
  return null;
}



// Main function
async function main() {
  try {
    // Initialize database connections
    await initializeDbConnections();
    
    // Get OAuth2 client and tokens
    let tokens = null;
    const oAuth2Client = getOAuth2Client();
    
    // Try to load tokens from file if specified
    if (options.tokens && fs.existsSync(options.tokens)) {
      tokens = loadTokensFromFile(options.tokens);
    }
    
    // If no tokens, get them interactively
    if (!tokens) {
      tokens = await getTokensInteractively();
    }
    
    // Set credentials on OAuth2 client
    oAuth2Client.setCredentials(tokens);
    log.info('OAuth client authenticated successfully');
    
    // Process users
    if (options.userId) {
      // Process specific user
      const user = await db.User.findByPk(options.userId);
      if (!user) {
        log.error(`User with ID ${options.userId} not found`);
        process.exit(1);
      }
      
      log.info(`Processing calendar data for user: ${user.name} (${user.id})`);
      await catalogingWorker.processCalendarData(
        { 
          oAuth2Client, // Pass the OAuth client
          tokens, // Pass the tokens
          // Include client credentials in tokens for refresh
          client_id: process.env.WORKER_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.WORKER_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
        },
        user, 
        { 
          monthsBack: options.months,
          verbose: options.verbose
        }
      );
    } else if (options.all) {
      // Process all users
      const users = await db.User.findAll();
      log.info(`Processing calendar data for ${users.length} users`);
      
      for (const user of users) {
        log.info(`Processing calendar data for user: ${user.name} (${user.id})`);
        await catalogingWorker.processCalendarData(
          { 
            oAuth2Client, // Pass the OAuth client
            tokens, // Pass the tokens
            // Include client credentials in tokens for refresh
            client_id: process.env.WORKER_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.WORKER_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
          },
          user, 
          { 
            monthsBack: options.months,
            verbose: options.verbose
          }
        );
      }
    } else {
      log.error('Either --userId or --all must be specified');
      process.exit(1);
    }
    
    log.info('Calendar data processing completed successfully');
    process.exit(0);
  } catch (error) {
    log.error(`Error in intelligence worker: ${error.message}`);
    if (options.verbose) {
      log.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the worker
main();

#!/usr/bin/env node

/**
 * Database Setup Script
 * Runs migrations and initializes the database schema
 */
const { sequelize, testConnection } = require('../config/database');
const { Sequelize } = require('sequelize');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Migration directory
const migrationsDir = path.join(__dirname, '../migrations');

async function runMigration(migrationFile) {
  console.log(`Running migration: ${migrationFile}`);
  
  // Load the migration file
  const migration = require(path.join(migrationsDir, migrationFile));
  
  // Run the up function
  await migration.up(sequelize.queryInterface, Sequelize);
  
  console.log(`Migration completed: ${migrationFile}`);
}

async function setupDatabase() {
  try {
    console.log('Testing database connection...');
    const connected = await testConnection();
    
    if (!connected) {
      console.error('Database connection failed. Please check your database configuration.');
      process.exit(1);
    }
    
    console.log('Database connection successful.');
    
    // Get all migration files and sort them
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files.`);
    
    // Run migrations in sequence
    for (const migrationFile of migrationFiles) {
      await runMigration(migrationFile);
    }
    
    console.log('All migrations completed successfully.');
    console.log('Database setup complete!');
    process.exit(0);
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  }
}

// Run the setup
setupDatabase();

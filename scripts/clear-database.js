#!/usr/bin/env node

/**
 * Clear Database Script
 * Clears all data from database tables while preserving table structure
 */

require('dotenv').config();
const { sequelize } = require('../config/database');

async function clearDatabase() {
  try {
    console.log('🗑️  Starting database cleanup...');
    
    // Test connection first
    await sequelize.authenticate();
    console.log('✅ Database connection established');
    
    // Get all table names from the database
    const [results] = await sequelize.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE 'SequelizeMeta'
    `);
    
    const tableNames = results.map(row => row.tablename);
    console.log(`📋 Found ${tableNames.length} tables to clear:`, tableNames);
    
    if (tableNames.length === 0) {
      console.log('ℹ️  No tables found to clear');
      return;
    }
    
    // Disable foreign key constraints temporarily
    console.log('🔓 Disabling foreign key constraints...');
    await sequelize.query('SET session_replication_role = replica;');
    
    // Clear each table
    for (const tableName of tableNames) {
      console.log(`🧹 Clearing table: ${tableName}`);
      await sequelize.query(`TRUNCATE TABLE "${tableName}" CASCADE;`);
    }
    
    // Re-enable foreign key constraints
    console.log('🔒 Re-enabling foreign key constraints...');
    await sequelize.query('SET session_replication_role = DEFAULT;');
    
    console.log('✅ Database cleanup completed successfully!');
    console.log(`📊 Cleared ${tableNames.length} tables:`);
    tableNames.forEach(table => console.log(`   - ${table}`));
    
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    throw error;
  } finally {
    // Close the connection
    await sequelize.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the script if called directly
if (require.main === module) {
  clearDatabase()
    .then(() => {
      console.log('🎉 Database cleanup script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Database cleanup script failed:', error);
      process.exit(1);
    });
}

module.exports = { clearDatabase };

/**
 * Migration to fix daily_briefings user_id column to reference google_id instead of UUID id
 */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Drop the existing foreign key constraint
    await queryInterface.removeConstraint('daily_briefings', 'daily_briefings_user_id_fkey');
    
    // Change the user_id column type from UUID to STRING
    await queryInterface.changeColumn('daily_briefings', 'user_id', {
      type: Sequelize.STRING,
      allowNull: false
    });
    
    // Add the new foreign key constraint referencing users.google_id
    await queryInterface.addConstraint('daily_briefings', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'daily_briefings_user_id_google_id_fkey',
      references: {
        table: 'users',
        field: 'google_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Drop the new foreign key constraint
    await queryInterface.removeConstraint('daily_briefings', 'daily_briefings_user_id_google_id_fkey');
    
    // Change the user_id column type back to UUID
    await queryInterface.changeColumn('daily_briefings', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false
    });
    
    // Add back the original foreign key constraint
    await queryInterface.addConstraint('daily_briefings', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'daily_briefings_user_id_fkey',
      references: {
        table: 'users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });
  }
};

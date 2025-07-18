/**
 * Migration: Modify Meetings User ID Column
 * Changes the user_id column from UUID to STRING and updates the foreign key reference
 */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First remove the existing foreign key constraint
    await queryInterface.removeConstraint(
      'meetings',
      'meetings_user_id_fkey'  // This is the default constraint name in PostgreSQL
    );

    // Then modify the column type
    await queryInterface.changeColumn('meetings', 'user_id', {
      type: Sequelize.STRING,
      allowNull: false
    });

    // Add the new foreign key constraint
    await queryInterface.addConstraint('meetings', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'meetings_user_id_fkey',
      references: {
        table: 'users',
        field: 'google_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // First remove the new foreign key constraint
    await queryInterface.removeConstraint(
      'meetings',
      'meetings_user_id_fkey'
    );

    // Then change the column back to UUID
    await queryInterface.changeColumn('meetings', 'user_id', {
      type: Sequelize.UUID,
      allowNull: false
    });

    // Add back the original foreign key constraint
    await queryInterface.addConstraint('meetings', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'meetings_user_id_fkey',
      references: {
        table: 'users',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });
  }
};

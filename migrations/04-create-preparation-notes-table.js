/**
 * Migration: Create Preparation Notes Table
 */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('preparation_notes', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      meeting_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'meetings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      note_text: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      is_private: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });
    
    // Add an index for faster queries
    await queryInterface.addIndex('preparation_notes', ['meeting_id', 'user_id']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('preparation_notes');
  }
};

/**
 * Migration to create the daily_briefings table
 */
'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if table exists first to avoid conflicts
    const tableExists = await queryInterface.showAllTables()
      .then(tables => tables.includes('daily_briefings'));
    
    if (tableExists) {
      console.log('Table daily_briefings already exists, skipping creation');
      return;
    }
    
    await queryInterface.createTable('daily_briefings', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
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
      briefing_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      summary_text: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      summary_html: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      meeting_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      people_overview: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      priority_preparations: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      generated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      status: {
        type: Sequelize.ENUM('pending', 'processing', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create a unique index on user_id and briefing_date
    try {
      await queryInterface.addIndex('daily_briefings', ['user_id', 'briefing_date'], {
        unique: true,
        name: 'daily_briefings_user_date_unique'
      });
    } catch (error) {
      console.log('Index daily_briefings_user_date_unique may already exist, skipping creation');
      console.log(error.message);
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('daily_briefings');
  }
};

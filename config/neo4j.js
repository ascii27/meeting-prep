/**
 * Neo4j database configuration
 */
require('dotenv').config();

module.exports = {
  uri: process.env.NEO4J_URI || 'neo4j://localhost:7687',
  username: process.env.NEO4J_USERNAME || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'password',
  database: process.env.NEO4J_DATABASE || 'neo4j'
};

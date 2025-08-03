#!/bin/bash
# Neo4j Setup Script for Meeting Prep Application
# This script helps set up Neo4j for the Meeting Prep application

set -e  # Exit on error

# Colors for terminal output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Meeting Prep Neo4j Setup ===${NC}"
echo -e "${BLUE}This script will help you set up Neo4j for the Meeting Prep application${NC}"
echo

# Check if Neo4j is installed
check_neo4j() {
  if command -v neo4j &> /dev/null; then
    echo -e "${GREEN}✓ Neo4j is installed${NC}"
    NEO4J_VERSION=$(neo4j version | head -n 1)
    echo -e "  Neo4j version: ${NEO4J_VERSION}"
    return 0
  else
    echo -e "${YELLOW}✗ Neo4j is not installed${NC}"
    return 1
  fi
}

# Install Neo4j using Homebrew
install_neo4j_homebrew() {
  echo -e "${BLUE}Installing Neo4j using Homebrew...${NC}"
  brew install neo4j
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Neo4j installed successfully${NC}"
  else
    echo -e "${RED}✗ Failed to install Neo4j${NC}"
    exit 1
  fi
}

# Start Neo4j service
start_neo4j() {
  echo -e "${BLUE}Starting Neo4j service...${NC}"
  brew services start neo4j
  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Neo4j service started${NC}"
  else
    echo -e "${RED}✗ Failed to start Neo4j service${NC}"
    exit 1
  fi
}

# Check if Neo4j is running
check_neo4j_running() {
  # Wait for Neo4j to start
  echo -e "${BLUE}Waiting for Neo4j to start (this may take a moment)...${NC}"
  sleep 5
  
  # Check if Neo4j is running on port 7687
  if nc -z localhost 7687 &> /dev/null; then
    echo -e "${GREEN}✓ Neo4j is running on port 7687${NC}"
    return 0
  else
    echo -e "${RED}✗ Neo4j is not running on port 7687${NC}"
    return 1
  fi
}

# Set up Neo4j password
setup_neo4j_password() {
  local password=$1
  echo -e "${BLUE}Setting up Neo4j password...${NC}"
  
  # Check if we can connect with default credentials
  if cypher-shell -u neo4j -p neo4j "RETURN 1;" &> /dev/null; then
    # Change the default password
    echo -e "${YELLOW}Changing default Neo4j password...${NC}"
    cypher-shell -u neo4j -p neo4j "ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO '$password';"
    if [ $? -eq 0 ]; then
      echo -e "${GREEN}✓ Neo4j password changed successfully${NC}"
    else
      echo -e "${RED}✗ Failed to change Neo4j password${NC}"
      exit 1
    fi
  else
    echo -e "${YELLOW}Default credentials not working. Password may already be set.${NC}"
  fi
}

# Create Neo4j constraints and indexes
create_constraints_and_indexes() {
  local username=$1
  local password=$2
  
  echo -e "${BLUE}Creating constraints and indexes for Meeting Prep...${NC}"
  
  # Connect to Neo4j and create constraints
  cypher-shell -u $username -p $password << 'EOF'
// Create constraints
CREATE CONSTRAINT person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE;
CREATE CONSTRAINT meeting_id IF NOT EXISTS FOR (m:Meeting) REQUIRE m.id IS UNIQUE;
CREATE CONSTRAINT document_id IF NOT EXISTS FOR (d:Document) REQUIRE d.id IS UNIQUE;
CREATE CONSTRAINT topic_name IF NOT EXISTS FOR (t:Topic) REQUIRE t.name IS UNIQUE;

// Create indexes
CREATE INDEX person_email_idx IF NOT EXISTS FOR (p:Person) ON (p.email);
CREATE INDEX meeting_date_idx IF NOT EXISTS FOR (m:Meeting) ON (m.date);
CREATE INDEX topic_relevance_idx IF NOT EXISTS FOR (t:Topic) ON (t.relevance);

// Success message
RETURN "Constraints and indexes created successfully" AS Success;
EOF

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Neo4j constraints and indexes created successfully${NC}"
  else
    echo -e "${RED}✗ Failed to create Neo4j constraints and indexes${NC}"
    exit 1
  fi
}

# Update .env file with Neo4j credentials
update_env_file() {
  local password=$1
  
  echo -e "${BLUE}Updating .env file with Neo4j credentials...${NC}"
  
  # Check if .env file exists
  if [ -f .env ]; then
    # Update Neo4j credentials in .env file
    sed -i '' 's|^NEO4J_URI=.*|NEO4J_URI=neo4j://localhost:7687|g' .env
    sed -i '' 's|^NEO4J_USERNAME=.*|NEO4J_USERNAME=neo4j|g' .env
    sed -i '' "s|^NEO4J_PASSWORD=.*|NEO4J_PASSWORD=$password|g" .env
    sed -i '' 's|^NEO4J_DATABASE=.*|NEO4J_DATABASE=neo4j|g' .env
    
    echo -e "${GREEN}✓ .env file updated with Neo4j credentials${NC}"
  else
    # Create .env file from .env.example
    if [ -f .env.example ]; then
      cp .env.example .env
      sed -i '' 's|^NEO4J_URI=.*|NEO4J_URI=neo4j://localhost:7687|g' .env
      sed -i '' 's|^NEO4J_USERNAME=.*|NEO4J_USERNAME=neo4j|g' .env
      sed -i '' "s|^NEO4J_PASSWORD=.*|NEO4J_PASSWORD=$password|g" .env
      sed -i '' 's|^NEO4J_DATABASE=.*|NEO4J_DATABASE=neo4j|g' .env
      
      echo -e "${GREEN}✓ .env file created from .env.example and updated with Neo4j credentials${NC}"
    else
      echo -e "${RED}✗ .env.example file not found${NC}"
      exit 1
    fi
  fi
}

# Main function
main() {
  echo -e "${BLUE}=== Step 1: Checking Neo4j installation ===${NC}"
  if ! check_neo4j; then
    echo -e "${YELLOW}Would you like to install Neo4j? (y/n)${NC}"
    read -r install_choice
    if [[ $install_choice =~ ^[Yy]$ ]]; then
      install_neo4j_homebrew
    else
      echo -e "${RED}Neo4j is required for the Meeting Prep application${NC}"
      echo -e "${YELLOW}Please install Neo4j manually and run this script again${NC}"
      exit 1
    fi
  fi
  
  echo -e "\n${BLUE}=== Step 2: Starting Neo4j service ===${NC}"
  start_neo4j
  
  if ! check_neo4j_running; then
    echo -e "${YELLOW}Waiting a bit longer for Neo4j to start...${NC}"
    sleep 10
    if ! check_neo4j_running; then
      echo -e "${RED}Neo4j service is not running. Please check Neo4j installation.${NC}"
      exit 1
    fi
  fi
  
  echo -e "\n${BLUE}=== Step 3: Setting up Neo4j credentials ===${NC}"
  echo -e "${YELLOW}Please enter a password for Neo4j (default: password):${NC}"
  read -r -s neo4j_password
  
  # Use default password if none provided
  if [ -z "$neo4j_password" ]; then
    neo4j_password="password"
    echo -e "${YELLOW}Using default password: 'password'${NC}"
  else
    echo -e "${GREEN}Password set${NC}"
  fi
  
  setup_neo4j_password "$neo4j_password"
  
  echo -e "\n${BLUE}=== Step 4: Creating Neo4j constraints and indexes ===${NC}"
  create_constraints_and_indexes "neo4j" "$neo4j_password"
  
  echo -e "\n${BLUE}=== Step 5: Updating environment variables ===${NC}"
  update_env_file "$neo4j_password"
  
  echo -e "\n${GREEN}=== Neo4j setup complete! ===${NC}"
  echo -e "${BLUE}You can now access the Neo4j Browser at: ${NC}http://localhost:7474/"
  echo -e "${BLUE}Username: ${NC}neo4j"
  echo -e "${BLUE}Password: ${NC}$neo4j_password"
  echo -e "${BLUE}Connection URI: ${NC}neo4j://localhost:7687"
  echo
  echo -e "${GREEN}The Meeting Prep application is now configured to use Neo4j.${NC}"
  echo -e "${YELLOW}Note: Make sure to restart your application to apply the changes.${NC}"
}

# Run the main function
main

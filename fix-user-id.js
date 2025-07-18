/**
 * Fix User ID Script
 * This script updates the preparation.js file to use googleId instead of id
 */
const fs = require('fs');
const path = require('path');

// Path to the preparation.js file
const filePath = path.join(__dirname, 'routes', 'preparation.js');

// Read the file
fs.readFile(filePath, 'utf8', (err, data) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Replace all instances of req.user.id with req.user.googleId
  const updatedData = data.replace(/req\.user\.id/g, 'req.user.googleId');

  // Write the updated content back to the file
  fs.writeFile(filePath, updatedData, 'utf8', (err) => {
    if (err) {
      console.error('Error writing file:', err);
      return;
    }
    console.log('Successfully updated preparation.js to use googleId instead of id');
  });
});

/**
 * Script to restore the original mediaUtils.js file from backup
 */
const fs = require('fs');
const path = require('path');

// Define file paths
const ORIGINAL_FILE_PATH = path.resolve(__dirname, '../utils/mediaUtils.js');
const BACKUP_FILE_PATH = path.resolve(__dirname, '../utils/mediaUtils.js.bak');

// Main function
async function restoreMediaUtils() {
  try {
    console.log('Starting mediaUtils restore script...');
    
    // Check if backup file exists
    if (!fs.existsSync(BACKUP_FILE_PATH)) {
      throw new Error('Backup file does not exist: ' + BACKUP_FILE_PATH);
    }
    
    // Restore from backup
    console.log('Restoring original file from backup...');
    fs.copyFileSync(BACKUP_FILE_PATH, ORIGINAL_FILE_PATH);
    
    console.log('mediaUtils.js successfully restored to original version!');
    return true;
  } catch (error) {
    console.error('Error restoring mediaUtils:', error);
    return false;
  }
}

// Run the restore if this script is executed directly
if (require.main === module) {
  restoreMediaUtils()
    .then(success => {
      if (success) {
        console.log('Restore completed successfully.');
      } else {
        console.error('Restore failed.');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}

module.exports = restoreMediaUtils;
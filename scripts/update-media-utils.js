/**
 * Script to update the mediaUtils.js file with the fixed version
 */
const fs = require('fs');
const path = require('path');

// Define file paths
const FIXED_FILE_PATH = path.resolve(__dirname, '../utils/mediaUtils.fixed.js');
const ORIGINAL_FILE_PATH = path.resolve(__dirname, '../utils/mediaUtils.js');
const BACKUP_FILE_PATH = path.resolve(__dirname, '../utils/mediaUtils.js.bak');

// Main function
async function updateMediaUtils() {
  try {
    console.log('Starting mediaUtils update script...');
    
    // Check if files exist
    if (!fs.existsSync(FIXED_FILE_PATH)) {
      throw new Error('Fixed file does not exist: ' + FIXED_FILE_PATH);
    }
    
    if (!fs.existsSync(ORIGINAL_FILE_PATH)) {
      throw new Error('Original file does not exist: ' + ORIGINAL_FILE_PATH);
    }
    
    // Create backup of original file if it doesn't already exist
    if (!fs.existsSync(BACKUP_FILE_PATH)) {
      console.log('Creating backup of original file...');
      fs.copyFileSync(ORIGINAL_FILE_PATH, BACKUP_FILE_PATH);
      console.log('Backup created at: ' + BACKUP_FILE_PATH);
    } else {
      console.log('Backup already exists, skipping backup creation.');
    }
    
    // Copy fixed file to replace the original
    console.log('Replacing original file with fixed version...');
    fs.copyFileSync(FIXED_FILE_PATH, ORIGINAL_FILE_PATH);
    
    console.log('mediaUtils.js successfully updated!');
    
    // Log a summary of changes
    console.log('\nSummary of key improvements:');
    console.log('1. Fixed formatGatewayUrl for consistent /ipfs/ handling');
    console.log('2. Centralized staking component detection logic');
    console.log('3. Improved IPFS CID extraction and gateway URL handling');
    console.log('4. Enhanced caching with separate TTLs for staking components');
    console.log('5. Added more efficient cache busting mechanism');
    console.log('6. Improved error handling and fallbacks');
    console.log('7. Optimized image loading in staking components');
    
    // Instructions for testing
    console.log('\nTo test the changes:');
    console.log('1. Run the development server: npm run dev');
    console.log('2. Navigate to the staking page to verify images load correctly');
    console.log('3. Check NFT galleries for proper image loading');
    console.log('4. If issues persist, you can restore the backup with:');
    console.log('   node ./scripts/restore-media-utils.js');
    
    return true;
  } catch (error) {
    console.error('Error updating mediaUtils:', error);
    return false;
  }
}

// Run the update if this script is executed directly
if (require.main === module) {
  updateMediaUtils()
    .then(success => {
      if (success) {
        console.log('Update completed successfully.');
      } else {
        console.error('Update failed.');
        process.exit(1);
      }
    })
    .catch(err => {
      console.error('Unexpected error:', err);
      process.exit(1);
    });
}

module.exports = updateMediaUtils;
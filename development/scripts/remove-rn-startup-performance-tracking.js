#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../..');

// Directories to exclude
const excludeDirs = new Set([
  'node_modules',
  'build',
  'dist',
  '.next',
  'coverage',
  '__tests__',
  '__mocks__',
  '.git',
]);

// File extensions to process
const extensions = new Set(['.ts', '.tsx']);

// Statistics
let stats = {
  processed: 0,
  skipped: 0,
  errors: 0,
  readyFilesDeleted: 0,
  eslintCommentsRemoved: 0,
};

function shouldExcludeDir(dirName) {
  return excludeDirs.has(dirName) || dirName.startsWith('tmp-') || dirName.startsWith('.');
}

function findFiles(dir, files = []) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!shouldExcludeDir(entry.name)) {
          findFiles(fullPath, files);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dir}:`, error.message);
  }

  return files;
}

function removePerformanceTracking(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Skip if no performance tracking
    if (!content.includes('$$perfStart_') && !content.includes('perfReady')) {
      stats.skipped++;
      return;
    }

    const relativePath = path.relative(rootDir, filePath);
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const fileNameWithoutExt = fileName.replace(/\.(ts|tsx)$/, '');
    const fileExt = fileName.endsWith('.tsx') ? 'tsx' : 'ts';
    const readyFileName = `${fileNameWithoutExt}.perfReady.${fileExt}`;
    const readyFilePath = path.join(fileDir, readyFileName);

    // Delete ready file if exists
    if (fs.existsSync(readyFilePath)) {
      fs.unlinkSync(readyFilePath);
      stats.readyFilesDeleted++;
      console.log(`✓ Deleted ready file: ${path.relative(rootDir, readyFilePath)}`);
    }

    let newContent = content;

    // Remove import statement
    const importPattern = new RegExp(`import '\\.\\/${fileNameWithoutExt}\\.perfReady';\\n`, 'g');
    newContent = newContent.replace(importPattern, '');

    // Remove the end tracking code
    newContent = newContent.replace(
      /\nif \(typeof \(globalThis as any\)\.\$\$perfStart_[a-zA-Z0-9_]+ !== 'undefined'\) \{[\s\S]*?\}\n?$/,
      ''
    );

    // Also try to remove old format (without 'as any')
    newContent = newContent.replace(
      /\nif \(typeof globalThis\.\$\$perfStart_[a-zA-Z0-9_]+ !== 'undefined'\) \{[\s\S]*?\}\n?$/,
      ''
    );

    // Check if we should remove the eslint-disable import/order comment
    // Remove it if it's at the beginning and there are no other imports that need it
    const eslintDisablePattern = /^\/\*\s*eslint-disable\s+import\/order\s*\*\/\s*\n/;
    
    if (eslintDisablePattern.test(newContent)) {
      // Check if the next line after eslint-disable is an import
      const afterEslintDisable = newContent.replace(eslintDisablePattern, '');
      
      // If there are no imports at the very beginning (or only perfReady import which we removed),
      // then we can safely remove the eslint-disable comment
      const startsWithImport = /^import\s+/.test(afterEslintDisable.trim());
      
      if (!startsWithImport) {
        newContent = newContent.replace(eslintDisablePattern, '');
        stats.eslintCommentsRemoved++;
        console.log(`✓ Removed eslint-disable comment from: ${relativePath}`);
      }
    }

    // Only write if content changed
    if (newContent !== content) {
      fs.writeFileSync(filePath, newContent, 'utf-8');
      console.log(`✓ Removed tracking from: ${relativePath}`);
      stats.processed++;
    } else {
      stats.skipped++;
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    stats.errors++;
  }
}

function processAllFiles() {
  const packagesDir = path.join(rootDir, 'packages');
  const appsDir = path.join(rootDir, 'apps');

  console.log('Finding all .ts and .tsx files...\n');

  const files = [
    ...findFiles(packagesDir),
    ...findFiles(appsDir),
  ];

  console.log(`Found ${files.length} files to process\n`);

  files.forEach((file) => {
    removePerformanceTracking(file);
  });

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Ready files deleted: ${stats.readyFilesDeleted}`);
  console.log(`  Eslint comments removed: ${stats.eslintCommentsRemoved}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('='.repeat(60));
  console.log('\n✓ Performance tracking removed from all files!');
}

// Main execution
if (require.main === module) {
  console.log('Removing performance tracking from all .ts and .tsx files...');
  console.log(`Root directory: ${rootDir}\n`);
  
  processAllFiles();
}

module.exports = { removePerformanceTracking };

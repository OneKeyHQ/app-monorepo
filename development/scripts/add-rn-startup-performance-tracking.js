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
  readyFilesCreated: 0,
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

function addPerformanceTracking(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Skip if already has performance tracking
    if (content.includes('$$perfStart_') || content.includes('perfReady')) {
      console.log(`Skipping (already has tracking): ${path.relative(rootDir, filePath)}`);
      stats.skipped++;
      return;
    }

    // Skip empty files
    if (!content.trim()) {
      console.log(`Skipping (empty): ${path.relative(rootDir, filePath)}`);
      stats.skipped++;
      return;
    }

    // Skip .d.ts files
    if (filePath.endsWith('.d.ts')) {
      console.log(`Skipping (type definition): ${path.relative(rootDir, filePath)}`);
      stats.skipped++;
      return;
    }

    const relativePath = path.relative(rootDir, filePath);
    const varName = relativePath
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 50);

    // Create ready file
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    const fileNameWithoutExt = fileName.replace(/\.(ts|tsx)$/, '');
    const fileExt = fileName.endsWith('.tsx') ? 'tsx' : 'ts';
    const readyFileName = `${fileNameWithoutExt}.perfReady.${fileExt}`;
    const readyFilePath = path.join(fileDir, readyFileName);

    // Create ready file content
    const readyFileContent = `// Performance tracking ready file - auto-generated
const $$perfStart_${varName} = typeof globalThis.nativePerformanceNow === 'function' ? globalThis.nativePerformanceNow() : Date.now();

if (typeof globalThis === 'object') {
  (globalThis as any).$$perfStart_${varName} = $$perfStart_${varName};
}

export {};
`;

    // Write ready file
    fs.writeFileSync(readyFilePath, readyFileContent, 'utf-8');
    stats.readyFilesCreated++;

    // Modify original file
    const importStatement = `import './${fileNameWithoutExt}.perfReady';\n`;
    
    // Check if file starts with eslint-disable import/order
    let newContent;
    const eslintDisablePattern = /^\/\*\s*eslint-disable\s+import\/order\s*\*\/\s*\n/;
    
    if (eslintDisablePattern.test(content)) {
      // Insert after eslint-disable comment
      newContent = content.replace(
        eslintDisablePattern,
        (match) => match + importStatement
      );
    } else {
      // Add eslint-disable and import at the beginning
      newContent = `/* eslint-disable import/order */\n${importStatement}${content}`;
    }

    // Add end tracking code
    const endCode = `\nif (typeof (globalThis as any).$$perfStart_${varName} !== 'undefined') {
  const $$perfEnd = typeof globalThis.nativePerformanceNow === 'function' ? globalThis.nativePerformanceNow() : Date.now();
  const $$perfDuration = $$perfEnd - (globalThis as any).$$perfStart_${varName};
  if (__DEV__) {
    if (globalThis.$rn_startup_performance_times === undefined) {
      globalThis.$rn_startup_performance_times = [];
    }
    globalThis.$rn_startup_performance_times.push({
      path: '${relativePath.replace(/\\/g, '/')}',
      duration: $$perfDuration,
    });
    console.log('[Performance] ${relativePath.replace(/\\/g, '/')}: ' + $$perfDuration + 'ms');
  }
}
`;

    newContent = newContent + endCode;

    // Write back to original file
    fs.writeFileSync(filePath, newContent, 'utf-8');
    console.log(`✓ Added tracking to: ${relativePath}`);
    stats.processed++;
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
    addPerformanceTracking(file);
  });

  console.log('\n' + '='.repeat(60));
  console.log('Summary:');
  console.log(`  Processed: ${stats.processed}`);
  console.log(`  Ready files created: ${stats.readyFilesCreated}`);
  console.log(`  Skipped: ${stats.skipped}`);
  console.log(`  Errors: ${stats.errors}`);
  console.log('='.repeat(60));
  console.log('\n✓ Performance tracking added to all files!');
}

// Main execution
if (require.main === module) {
  console.log('Adding performance tracking to all .ts and .tsx files...');
  console.log(`Root directory: ${rootDir}\n`);
  
  processAllFiles();
}

module.exports = { addPerformanceTracking };

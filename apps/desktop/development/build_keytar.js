const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Current working directory:', process.cwd());
console.log('Operating system:', process.platform);
console.log('Architecture:', process.arch);

// Try to find keytar in different locations (supports both yarn and bun)
const possiblePaths = [
  path.join(__dirname, '..', '..', '..', 'node_modules', 'keytar'),
  path.join(
    __dirname,
    '..',
    '..',
    '..',
    'node_modules',
    '.bun',
    'keytar@7.9.0',
    'node_modules',
    'keytar',
  ),
];

let keytarPath = null;
for (const p of possiblePaths) {
  if (fs.existsSync(p)) {
    keytarPath = p;
    break;
  }
}

if (!keytarPath) {
  // Try to resolve via require.resolve
  try {
    keytarPath = path.dirname(require.resolve('keytar/package.json'));
  } catch (e) {
    console.error('Could not find keytar package');
    process.exit(1);
  }
}

console.log('Found keytar at:', keytarPath);
process.chdir(keytarPath);

try {
  execSync('npx node-gyp rebuild', { stdio: 'inherit' });

  const keytarNodePath = path.join('build', 'Release', 'keytar.node');
  if (fs.existsSync(keytarNodePath)) {
    console.log(`File ${keytarNodePath} exists`);
    const stats = fs.statSync(keytarNodePath);
    console.log(`File type: ${stats.isFile() ? 'Regular file' : 'Other'}`);
    console.log(`File size: ${stats.size} bytes`);
  } else {
    console.log(`File ${keytarNodePath} does not exist`);
  }
} catch (error) {
  console.error('An error occurred:', error);
}

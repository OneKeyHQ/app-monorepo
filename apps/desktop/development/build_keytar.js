const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('Current working directory:', process.cwd());
console.log('Operating system:', process.platform);
console.log('Architecture:', process.arch);

const keytarPath = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'node_modules',
  'keytar',
);
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

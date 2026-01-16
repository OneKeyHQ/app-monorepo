const fs = require('fs');
const path = require('path');
const process = require('process');
const { execSync } = require('child_process');

function getPatchTargets(patchesDir) {
  // Read all files in the patches directory
  try {
    const files = fs.readdirSync(patchesDir);
    // Filter out non-patch files if needed, here we assume all files are valid
    return files.map((file) => {
      // Patch files are usually named like 'package+version.patch'
      // Extract the package name before the first '+'
      // If the file name contains '+', convert it to a '/' path for scoped packages
      const patchName = file.replace(/\.patch$/, '');
      if (patchName.includes('+')) {
        // Only keep the part before the last '+' (remove version info)
        const lastPlusIndex = patchName.lastIndexOf('+');
        const namePart = patchName.substring(0, lastPlusIndex);
        // Replace the first '+' with '/' to form the package path for scoped packages
        const firstPlusIndex = namePart.indexOf('+');
        if (firstPlusIndex !== -1) {
          return `${namePart.substring(0, firstPlusIndex)}/${namePart.substring(
            firstPlusIndex + 1,
          )}`;
        }
        return namePart;
      }
      return patchName;
    });
  } catch (err) {
    console.error(`Failed to read patches directory: ${err.message}`);
    process.exit(1);
  }
}

function removeNodeModule(pkgName) {
  // Support scoped packages
  const nodeModulesPath = path.resolve('node_modules');
  let pkgPath;
  if (pkgName.startsWith('@')) {
    // Scoped package: @scope/name
    const [scope, name] = pkgName.split('/');
    if (!name) return;
    pkgPath = path.join(nodeModulesPath, scope, name);
  } else {
    pkgPath = path.join(nodeModulesPath, pkgName);
  }
  if (fs.existsSync(pkgPath)) {
    try {
      // Remove the entire pkgPath directory recursively and forcefully
      if (process.platform === 'win32') {
        fs.rmSync(pkgPath, { recursive: true, force: true });
      } else {
        try {
          execSync(`rm -rf "${pkgPath}"`);
        } catch (shellErr) {
          throw new Error(`Shell rm failed: ${shellErr.message}`);
        }
      }

      console.log(`Removed: ${pkgPath}`);
    } catch (err) {
      console.error(`Failed to remove ${pkgPath}: ${err.message}`);
    }
  } else {
    console.log(`Not found, skip: ${pkgPath}`);
  }
}

function main() {
  const patchesDir = path.resolve('patches');
  if (!fs.existsSync(patchesDir)) {
    console.error('patches directory not found.');
    process.exit(1);
  }
  const targets = getPatchTargets(patchesDir);
  if (targets.length === 0) {
    console.log('No patch files found in patches directory.');
    return;
  }
  console.log('Removing the following node_modules packages:');
  console.log(targets);
  targets.forEach((pkg) => {
    console.log(`- ${pkg}`);
    removeNodeModule(pkg);
  });
  console.log(
    '\nPlease re-run `yarn` to reinstall the removed packages and re-apply patches.',
  );
}

main();

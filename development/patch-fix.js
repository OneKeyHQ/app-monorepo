const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');

function getPatchTargets(patchesDir) {
  // Read all files in the patches directory
  try {
    const files = fs.readdirSync(patchesDir);
    const targets = files
      .filter((file) => file.endsWith('.patch'))
      .map((file) => {
        // Version, sequence number and label follow the package name.
        const [nameOrScope, scopedName] = file.split('+');
        return nameOrScope.startsWith('@')
          ? `${nameOrScope}/${scopedName}`
          : nameOrScope;
      });
    return [...new Set(targets)];
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
          throw new Error(`Shell rm failed: ${shellErr.message}`, {
            cause: shellErr,
          });
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

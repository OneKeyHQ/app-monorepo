const fs = require('fs');
const path = require('path');

/**
 * Remove cross-OS native prebuilds from source node_modules BEFORE asar packing.
 *
 * Many packages (serialport, noble, usb, bufferutil, etc.) ship prebuilds for
 * every OS, but each build only needs its own platform. By removing them before
 * packing we ensure the asar index never references files that don't exist —
 * fixing the ENOENT errors reported in GitHub issue #10814.
 *
 * All arch variants for the target OS are kept so that runtime fallbacks still
 * work (e.g., Windows ARM64 runs x64 binaries via WoW64 emulation).
 */
exports.default = async function beforePack(context) {
  const { electronPlatformName } = context;
  const platformPrefix =
    electronPlatformName === 'mas' ? 'darwin' : electronPlatformName;
  const knownPlatforms = ['android', 'darwin', 'linux', 'win32'];
  let removedCount = 0;

  // --- helpers (same logic that was previously in afterPack) ---

  const findPrebuildsRecursive = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const fullPath = path.join(dir, entry.name);
        if (entry.name === 'prebuilds') {
          processPrebuildsDir(fullPath);
        } else if (
          entry.name !== '.cache' &&
          entry.name !== '.git' &&
          entry.name !== '.yarn'
        ) {
          findPrebuildsRecursive(fullPath);
        }
      }
    }
  };

  const processPrebuildsDir = (fullPath) => {
    let prebuildEntries;
    try {
      prebuildEntries = fs.readdirSync(fullPath, { withFileTypes: true });
    } catch {
      return;
    }
    console.log(`[beforePack:prebuilds] Scanning: ${fullPath}`);
    for (const prebuild of prebuildEntries) {
      if (prebuild.isDirectory()) {
        processPrebuildEntry(fullPath, prebuild.name);
      }
    }
  };

  const processPrebuildEntry = (parentDir, prebuildName) => {
    // Only process dirs with known OS prefix (e.g., "linux-x64").
    // Skip non-standard names like "node", "apple" to be safe.
    const isKnownPlatform = knownPlatforms.some(
      (p) => prebuildName === p || prebuildName.startsWith(`${p}-`),
    );
    if (!isKnownPlatform) {
      console.log(
        `[beforePack:prebuilds]   Skipped (non-standard): ${prebuildName}`,
      );
      return;
    }
    if (
      prebuildName === platformPrefix ||
      prebuildName.startsWith(`${platformPrefix}-`)
    ) {
      console.log(`[beforePack:prebuilds]   Kept: ${prebuildName}`);
      return;
    }
    try {
      fs.rmSync(path.join(parentDir, prebuildName), { recursive: true });
      console.log(`[beforePack:prebuilds]   Removed: ${prebuildName}`);
      removedCount += 1;
    } catch (err) {
      console.warn(
        `[beforePack:prebuilds]   Failed to remove ${prebuildName}: ${err.message}`,
      );
    }
  };

  // --- scan source node_modules ---

  const projectDir = context.packager.projectDir; // apps/desktop
  const nodeModulesDir = path.join(projectDir, 'node_modules');

  console.log(
    `[beforePack:prebuilds] Cleaning cross-OS prebuilds from source (keeping: ${platformPrefix}-*)`,
  );

  if (fs.existsSync(nodeModulesDir)) {
    console.log(`[beforePack:prebuilds] Searching: ${nodeModulesDir}`);
    findPrebuildsRecursive(nodeModulesDir);
  }

  console.log(
    `[beforePack:prebuilds] Done. Removed ${removedCount} directories.`,
  );
};

import { execFile } from 'child_process';
import path from 'path';
import { promisify } from 'util';

import isDev from 'electron-is-dev';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const execFileAsync = promisify(execFile);

// Get architecture suffix for the binary (x64 or arm64)
const getArchSuffix = (): string => {
  // Electron uses 'x64' and 'arm64' for process.arch
  // Map them to match our binary naming convention
  const arch = process.arch;
  if (arch === 'x64' || arch === 'arm64') {
    return arch;
  }
  // Fallback to x64 if unknown architecture
  console.warn(
    `Unknown architecture: ${arch}, falling back to x64 for Mac API Bridge`,
  );
  return 'x64';
};

// Path to the bundled Mac API Bridge tool
export const getMacApiBridgeCLI = (): string => {
  const archSuffix = getArchSuffix();
  const binaryName = `onekey-desktop-mac-api-bridge-${archSuffix}`;

  if (isDev) {
    // Development: architecture-specific helper is in scripts/MacApiBridge/bin/
    return path.join(
      __dirname,
      `../../../../apps/desktop/scripts/MacApiBridge/bin/${binaryName}`,
    );
  }

  // Production: architecture-specific helper is in Resources/bin/
  return path.join(process.resourcesPath, `bin/${binaryName}`);
};

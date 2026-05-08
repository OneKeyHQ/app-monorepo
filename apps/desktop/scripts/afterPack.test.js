const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  BRIDGE_BINARY_MODE,
  chmodPackagedBridgeBinary,
  getPackagedBridgeBinaryPath,
} = require('./afterPack');

function createContext(electronPlatformName) {
  const appOutDir = fs.mkdtempSync(path.join(os.tmpdir(), 'after-pack-test-'));
  return {
    electronPlatformName,
    appOutDir,
    packager: {
      appInfo: {
        productFilename: 'OneKey',
      },
    },
  };
}

function cleanupContext(context) {
  fs.rmSync(context.appOutDir, { recursive: true, force: true });
}

function writeBridgeBinary(context) {
  const bridgeBinaryPath = getPackagedBridgeBinaryPath(context);
  fs.mkdirSync(path.dirname(bridgeBinaryPath), { recursive: true });
  fs.writeFileSync(bridgeBinaryPath, 'binary');
  fs.chmodSync(bridgeBinaryPath, 0o644);
  return bridgeBinaryPath;
}

describe('afterPack bridge permissions', () => {
  test('restores executable bit for packaged macOS bridge binary', () => {
    const context = createContext('darwin');
    try {
      const bridgeBinaryPath = writeBridgeBinary(context);

      chmodPackagedBridgeBinary(context);

      expect(fs.statSync(bridgeBinaryPath).mode & BRIDGE_BINARY_MODE).toBe(
        BRIDGE_BINARY_MODE,
      );
    } finally {
      cleanupContext(context);
    }
  });

  test('restores executable bit for packaged Linux bridge binary', () => {
    const context = createContext('linux');
    try {
      const bridgeBinaryPath = writeBridgeBinary(context);

      chmodPackagedBridgeBinary(context);

      expect(fs.statSync(bridgeBinaryPath).mode & BRIDGE_BINARY_MODE).toBe(
        BRIDGE_BINARY_MODE,
      );
    } finally {
      cleanupContext(context);
    }
  });
});

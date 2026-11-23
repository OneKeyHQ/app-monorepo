const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('./ensure-runtime-noble', () => ({
  ...jest.requireActual('./ensure-runtime-noble'),
  getWindowsBindingPath: jest.fn(),
}));

const {
  default: afterPack,
  BRIDGE_BINARY_MODE,
  chmodPackagedBridgeBinary,
  getPackagedBridgeBinaryPath,
} = require('./afterPack');
const {
  getWindowsBindingPath,
  verifyWindowsBinding,
} = require('./ensure-runtime-noble');

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

describe('Windows Noble packaging', () => {
  test.each([
    ['x64', 1, 0x86_64],
    ['arm64', 3, 0xaa_64],
  ])(
    'copies the staged %s binding into its installer and rejects another architecture',
    async (architecture, arch, machine) => {
      const context = { ...createContext('win32'), arch };
      try {
        const staged = path.join(context.appOutDir, 'staged.node');
        const bytes = Buffer.concat([
          Buffer.alloc(128),
          Buffer.from(
            'nativeErrorDomain nativeErrorCode could not activate maintained GATT session',
          ),
        ]);
        bytes.write('MZ');
        bytes.writeUInt32LE(64, 0x3c);
        bytes.writeUInt32LE(0x00_00_45_50, 64);
        bytes.writeUInt16LE(machine, 68);
        fs.writeFileSync(staged, bytes);
        getWindowsBindingPath.mockReturnValue(staged);
        await afterPack(context);
        const packaged = path.join(
          context.appOutDir,
          'resources/app.asar.unpacked/node_modules/@stoprocent/noble/build/Release/binding.node',
        );
        expect(fs.readFileSync(packaged)).toEqual(bytes);
        expect(() =>
          verifyWindowsBinding(
            packaged,
            architecture === 'x64' ? 'arm64' : 'x64',
          ),
        ).toThrow(/wrong Windows architecture/);
      } finally {
        cleanupContext(context);
      }
    },
  );
});

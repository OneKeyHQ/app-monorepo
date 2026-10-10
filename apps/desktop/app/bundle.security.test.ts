import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getMetadata, readVerifiedBundleFile } from './bundle';

let mockExpectedSha256 = '';

jest.mock('openpgp', () => ({
  readCleartextMessage: jest.fn(async () => ({
    getText: () => JSON.stringify({ sha256: mockExpectedSha256 }),
    verify: async () => [{ verified: Promise.resolve(true) }],
  })),
  readKey: jest.fn(async () => ({})),
}));

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => os.tmpdir()) },
  dialog: { showMessageBox: jest.fn() },
}));
jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

describe('desktop bundle bytes', () => {
  let root: string;
  let bundleDirPath: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-bundle-security-'));
    bundleDirPath = path.join(root, 'build');
    fs.mkdirSync(bundleDirPath);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  test('parses the same metadata bytes whose signed hash was checked', async () => {
    const metadataPath = path.join(root, 'metadata.json');
    const replacementPath = path.join(root, 'replacement.json');
    const signedBytes = Buffer.from(JSON.stringify({ 'index.html': 'signed' }));
    fs.writeFileSync(metadataPath, signedBytes);
    fs.writeFileSync(
      replacementPath,
      JSON.stringify({ 'index.html': 'replacement' }),
    );
    mockExpectedSha256 = crypto
      .createHash('sha256')
      .update(signedBytes)
      .digest('hex');

    const readFileSync = fs.readFileSync;
    let metadataReads = 0;
    const readSpy = jest
      .spyOn(fs, 'readFileSync')
      .mockImplementation((file) => {
        expect(file).toBe(metadataPath);
        const bytes = readFileSync(file);
        metadataReads += 1;
        if (metadataReads === 1) {
          fs.renameSync(replacementPath, metadataPath);
        }
        return bytes;
      });
    try {
      await expect(
        getMetadata({
          bundleDir: bundleDirPath,
          appVersion: '1.0.0',
          bundleVersion: '1',
          signature: 'signed',
        }),
      ).resolves.toEqual({ 'index.html': 'signed' });
      expect(metadataReads).toBe(1);
    } finally {
      readSpy.mockRestore();
    }
  });

  test('keeps the verified resource bytes after its path is replaced', () => {
    const filePath = path.join(bundleDirPath, 'index.html');
    const replacementPath = path.join(root, 'replacement.html');
    const signedBytes = Buffer.from('<body>SIGNED</body>');
    fs.writeFileSync(filePath, signedBytes);
    fs.writeFileSync(replacementPath, '<body>REPLACED</body>');

    const result = readVerifiedBundleFile({
      bundleDirPath,
      metadata: {
        'index.html': crypto
          .createHash('sha512')
          .update(signedBytes)
          .digest('hex'),
      },
      driveLetter: '',
      url: 'index.html',
    });
    fs.renameSync(replacementPath, filePath);

    expect(result.bytes.equals(signedBytes)).toBe(true);
    expect(fs.readFileSync(filePath).equals(signedBytes)).toBe(false);
  });

  test('rejects a signed metadata key outside the bundle directory', () => {
    const outsidePath = path.join(root, 'outside.js');
    const bytes = Buffer.from('outside');
    fs.writeFileSync(outsidePath, bytes);
    expect(() =>
      readVerifiedBundleFile({
        bundleDirPath,
        metadata: {
          '../outside.js': crypto
            .createHash('sha512')
            .update(bytes)
            .digest('hex'),
        },
        driveLetter: '',
        url: '../outside.js',
      }),
    ).toThrow('outside the bundle directory');
  });

  test('rejects a symlink that points outside the bundle directory', () => {
    const outsidePath = path.join(root, 'outside.js');
    const bytes = Buffer.from('outside');
    fs.writeFileSync(outsidePath, bytes);
    fs.symlinkSync(outsidePath, path.join(bundleDirPath, 'linked.js'));
    expect(() =>
      readVerifiedBundleFile({
        bundleDirPath,
        metadata: {
          'linked.js': crypto.createHash('sha512').update(bytes).digest('hex'),
        },
        driveLetter: '',
        url: 'linked.js',
      }),
    ).toThrow('outside the bundle directory');
  });
});

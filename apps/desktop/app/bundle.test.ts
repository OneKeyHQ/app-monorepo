/* eslint-disable import/first */
// Desktop bundle utility tests
// Tests calculateSHA256, verifySha256, checkFileSha512, and testExtractedSha256FromVerifyAscFile
// from apps/desktop/app/bundle.ts
//
// We mock Electron APIs (app, dialog) and electron-log since they are unavailable in Jest.

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// --- Mocks must be defined before imports ---

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => os.tmpdir()),
    getVersion: jest.fn(() => '1.0.0'),
    getAppPath: jest.fn(() => '/mock/app'),
    exit: jest.fn(),
  },
  dialog: {
    showMessageBox: jest.fn(() => Promise.resolve({ response: 0 })),
  },
}));

jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('./libs/store', () => ({
  clearUpdateBundleData: jest.fn(),
  getNativeVersion: jest.fn(() => '1.0.0'),
  getNativeBuildNumber: jest.fn(() => ''),
  getUpdateBundleData: jest.fn(() => null),
  setUpdateBundleData: jest.fn(),
  setNativeVersion: jest.fn(),
  setNativeBuildNumber: jest.fn(),
  getFallbackUpdateBundleData: jest.fn(() => []),
  setFallbackUpdateBundleData: jest.fn(),
}));

import {
  calculateSHA256,
  checkFileSha512,
  testExtractedSha256FromVerifyAscFile,
  verifySha256,
} from './bundle';

// --- Helpers ---

function createTempFile(content: string): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bundle-test-'));
  const filePath = path.join(tmpDir, 'test-file.txt');
  fs.writeFileSync(filePath, content, 'utf8');
  return filePath;
}

function cleanupTempFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
    fs.rmdirSync(path.dirname(filePath));
  } catch {
    // ignore cleanup errors
  }
}

function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function computeSha512(content: string): string {
  return crypto.createHash('sha512').update(content).digest('hex');
}

// ---------------------------------------------------------------------------
// calculateSHA256
// ---------------------------------------------------------------------------
describe('calculateSHA256', () => {
  test('calculates correct SHA256 for known content', () => {
    const filePath = createTempFile('hello');
    try {
      const result = calculateSHA256(filePath);
      expect(result).toBe(computeSha256('hello'));
      expect(result).toBe(
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      );
    } finally {
      cleanupTempFile(filePath);
    }
  });

  test('returns empty string for empty filePath', () => {
    expect(calculateSHA256('')).toBe('');
  });

  test('calculates SHA256 for empty file', () => {
    const filePath = createTempFile('');
    try {
      const result = calculateSHA256(filePath);
      expect(result).toBe(computeSha256(''));
      expect(result).toBe(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      );
    } finally {
      cleanupTempFile(filePath);
    }
  });

  test('different content produces different hash', () => {
    const fileA = createTempFile('content A');
    const fileB = createTempFile('content B');
    try {
      const hashA = calculateSHA256(fileA);
      const hashB = calculateSHA256(fileB);
      expect(hashA).not.toBe(hashB);
      expect(hashA.length).toBe(64);
      expect(hashB.length).toBe(64);
    } finally {
      cleanupTempFile(fileA);
      cleanupTempFile(fileB);
    }
  });

  test('same content produces same hash', () => {
    const file1 = createTempFile('identical content');
    const file2 = createTempFile('identical content');
    try {
      expect(calculateSHA256(file1)).toBe(calculateSHA256(file2));
    } finally {
      cleanupTempFile(file1);
      cleanupTempFile(file2);
    }
  });

  test('throws for non-existent file', () => {
    expect(() => calculateSHA256('/non/existent/path.txt')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// verifySha256
// ---------------------------------------------------------------------------
describe('verifySha256', () => {
  test('returns true when SHA256 matches', () => {
    const content = 'verification test';
    const filePath = createTempFile(content);
    try {
      const sha256 = computeSha256(content);
      expect(verifySha256(filePath, sha256)).toBe(true);
    } finally {
      cleanupTempFile(filePath);
    }
  });

  test('returns false when SHA256 does not match', () => {
    const filePath = createTempFile('some content');
    try {
      expect(verifySha256(filePath, 'wrong_hash')).toBe(false);
    } finally {
      cleanupTempFile(filePath);
    }
  });

  test('returns false for empty filePath', () => {
    expect(verifySha256('', 'somehash')).toBe(false);
  });

  test('returns false for empty sha256', () => {
    const filePath = createTempFile('data');
    try {
      expect(verifySha256(filePath, '')).toBe(false);
    } finally {
      cleanupTempFile(filePath);
    }
  });

  test('returns false for both empty', () => {
    expect(verifySha256('', '')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// checkFileSha512
// ---------------------------------------------------------------------------
describe('checkFileSha512', () => {
  test('returns true when SHA512 matches', () => {
    const content = 'sha512 test';
    const filePath = createTempFile(content);
    try {
      const sha512 = computeSha512(content);
      expect(checkFileSha512(filePath, sha512)).toBe(true);
    } finally {
      cleanupTempFile(filePath);
    }
  });

  test('returns false when SHA512 does not match', () => {
    const filePath = createTempFile('sha512 content');
    try {
      expect(checkFileSha512(filePath, 'wrong_hash')).toBe(false);
    } finally {
      cleanupTempFile(filePath);
    }
  });
});

// ---------------------------------------------------------------------------
// testExtractedSha256FromVerifyAscFile - GPG signature verification
// ---------------------------------------------------------------------------
describe('testExtractedSha256FromVerifyAscFile', () => {
  test('verifies embedded test GPG signature returns correct SHA256', async () => {
    const result = await testExtractedSha256FromVerifyAscFile();
    expect(result).toBe(true);
  });
});

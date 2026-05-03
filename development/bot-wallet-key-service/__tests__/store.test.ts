import * as fs from 'node:fs';
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { platform, tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';

import { Store } from '../src/store';

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), 'bwks-store-'));
}

describe('Store persistence (AC5)', () => {
  let dir: string;
  let filePath: string;

  beforeEach(() => {
    dir = freshDir();
    filePath = join(dir, 'keys.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('initialises with empty Map when file does not exist (first boot)', () => {
    const s = new Store({ filePath });
    expect(s.snapshot()).toEqual({});
    expect(s.has('any')).toBe(false);
  });

  it('persists records via atomic rename and reloads them on restart', () => {
    const s1 = new Store({ filePath });
    s1.insert('keyA', {
      keyBase64: 'AAAA',
      accessTokenSha256: 'BB',
      createdAt: 1000,
    });
    s1.insert('keyB', {
      keyBase64: 'CCCC',
      accessTokenSha256: 'DD',
      createdAt: 2000,
    });
    expect(fs.existsSync(filePath)).toBe(true);

    const s2 = new Store({ filePath });
    expect(s2.snapshot()).toEqual({
      keyA: { keyBase64: 'AAAA', accessTokenSha256: 'BB', createdAt: 1000 },
      keyB: { keyBase64: 'CCCC', accessTokenSha256: 'DD', createdAt: 2000 },
    });
  });

  it('persisted file has mode 0600 (owner-only) on POSIX', () => {
    if (platform() === 'win32') {
      // Windows file modes are different; skip but keep coverage on POSIX.
      return;
    }
    const s = new Store({ filePath });
    s.insert('keyA', {
      keyBase64: 'AAAA',
      accessTokenSha256: 'BB',
      createdAt: 1,
    });
    // eslint-disable-next-line no-bitwise
    const mode = statSync(filePath).mode & 0o777;
    expect(mode).toBe(0o600);
  });

  it('a rename failure leaves the previous file intact (atomic recovery)', async () => {
    const { fsBridge } = await import('../src/fs-bridge');
    const s = new Store({ filePath });
    s.insert('keyA', {
      keyBase64: 'AAAA',
      accessTokenSha256: 'BB',
      createdAt: 1,
    });
    const beforeRaw = fs.readFileSync(filePath, 'utf8');

    const renameSpy = jest
      .spyOn(fsBridge, 'renameSync')
      .mockImplementation(() => {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('simulated rename failure');
      });

    expect(() =>
      s.insert('keyB', {
        keyBase64: 'CCCC',
        accessTokenSha256: 'DD',
        createdAt: 2,
      }),
    ).toThrow(/simulated rename failure/);

    // Original file content untouched
    expect(fs.readFileSync(filePath, 'utf8')).toBe(beforeRaw);
    expect(s.has('keyB')).toBe(false);
    // Tmp must have been cleaned up
    expect(fs.existsSync(`${filePath}.tmp`)).toBe(false);
    renameSpy.mockRestore();
  });

  it('a revoke flush failure leaves in-memory record unrevoked', async () => {
    const { fsBridge } = await import('../src/fs-bridge');
    const s = new Store({ filePath });
    s.insert('keyA', {
      keyBase64: 'AAAA',
      accessTokenSha256: 'BB',
      createdAt: 1,
    });

    const renameSpy = jest
      .spyOn(fsBridge, 'renameSync')
      .mockImplementation(() => {
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('simulated rename failure');
      });

    expect(() => s.revoke('keyA', 5000)).toThrow(/simulated rename failure/);
    expect(s.get('keyA')).toEqual({
      keyBase64: 'AAAA',
      accessTokenSha256: 'BB',
      createdAt: 1,
    });
    renameSpy.mockRestore();
  });

  it('throws fail-secure on corrupt JSON (does NOT silently reset)', () => {
    writeFileSync(filePath, '{not json', 'utf8');
    expect(() => new Store({ filePath })).toThrow(/corrupt JSON/);
  });

  it('throws fail-secure when persisted record contains forbidden fields', () => {
    writeFileSync(
      filePath,
      JSON.stringify({
        keyA: {
          keyBase64: 'AAAA',
          accessTokenSha256: 'BB',
          createdAt: 1,
          ciphertextBase64: 'LEAK',
        },
      }),
      'utf8',
    );
    expect(() => new Store({ filePath })).toThrow(
      /PersistenceWhitelistViolation/,
    );
  });

  it('revoke is idempotent and persists revokedAt', () => {
    const s = new Store({ filePath });
    s.insert('keyA', {
      keyBase64: 'AAAA',
      accessTokenSha256: 'BB',
      createdAt: 1,
    });
    expect(s.revoke('keyA', 5000)).toBe(true);
    expect(s.get('keyA')?.revokedAt).toBe(5000);
    expect(s.get('keyA')?.keyBase64).toBe('');
    // Second revoke is no-op (still returns true) and does not change the
    // original revokedAt timestamp.
    expect(s.revoke('keyA', 9999)).toBe(true);
    expect(s.get('keyA')?.revokedAt).toBe(5000);
  });

  it('revoke returns false for unknown keyId', () => {
    const s = new Store({ filePath });
    expect(s.revoke('nope', 1)).toBe(false);
  });

  it('insert refuses to overwrite an existing keyId', () => {
    const s = new Store({ filePath });
    s.insert('keyA', {
      keyBase64: 'AAAA',
      accessTokenSha256: 'BB',
      createdAt: 1,
    });
    expect(() =>
      s.insert('keyA', {
        keyBase64: 'CCCC',
        accessTokenSha256: 'DD',
        createdAt: 2,
      }),
    ).toThrow(/keyId already exists/);
  });
});

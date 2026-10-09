/* eslint-disable import-path/parent-depth -- Import fixture/helper files directly to avoid the duplicate Desktop package name in the root Jest haste map. */
import { createHash } from 'crypto';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import AdmZip from 'adm-zip';

import { writeNativeCrashReport } from '../../../../apps/desktop/app/libs/nativeCrashFiles';
import { parseNativeMinidump } from '../../../../apps/desktop/app/libs/nativeCrashMinidump';
import { makeSyntheticDump } from '../../../../apps/desktop/app/libs/nativeCrashTestFixture';

import DesktopApiDev from './DesktopApiDev';

import type { IDesktopApi } from './instance/IDesktopApi';

let mockLogPath = '';
const mockCollect = jest.fn(async () => {});
jest.mock('@onekeyhq/desktop/app/config', () => ({ ipcMessageKeys: {} }), {
  virtual: true,
});
jest.mock(
  '@onekeyhq/desktop/app/libs/nativeCrash',
  () => ({ collectNativeCrashReports: () => mockCollect() }),
  { virtual: true },
);
jest.mock(
  '@onekeyhq/desktop/app/libs/nativeCrashFiles',
  () =>
    require('../../../../apps/desktop/app/libs/nativeCrashFiles') as typeof import('../../../../apps/desktop/app/libs/nativeCrashFiles'),
  { virtual: true },
);
jest.mock('@onekeyhq/desktop/app/libs/networkThrottle', () => ({}), {
  virtual: true,
});
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({}), { virtual: true });
jest.mock(
  '@onekeyhq/desktop/app/logger',
  () => ({ flushDesktopDedup: jest.fn() }),
  { virtual: true },
);
jest.mock('@onekeyhq/shared/src/request/customUA', () => ({}));
jest.mock('electron', () => ({ shell: {} }));
jest.mock('electron-log/main', () => ({
  transports: { file: { getFile: () => ({ path: mockLogPath }) } },
  warn: jest.fn(),
}));

describe('Desktop manual export and upload ZIP collector', () => {
  let directory: string;
  let api: DesktopApiDev;
  const download = jest.fn();
  beforeEach(async () => {
    directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-export-fixture-'),
    );
    const logDir = path.join(directory, 'logs');
    await fs.mkdir(logDir);
    mockLogPath = path.join(logDir, 'app-latest.log');
    await fs.writeFile(mockLogPath, 'existing ordinary log');
    mockCollect.mockReset();
    mockCollect.mockResolvedValue(undefined);
    download.mockClear();
    api = new DesktopApiDev({
      desktopApi: {
        appUpdate: {
          getMainWindow: () => ({
            isDestroyed: () => false,
            webContents: { downloadURL: download },
          }),
        },
      } as unknown as IDesktopApi,
    });
  });
  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });
  test('the actual shared collector includes sanitized crash JSON and preserves its digest contract', async () => {
    const dump = path.join(directory, 'synthetic.dmp');
    await fs.writeFile(dump, makeSyntheticDump());
    await writeNativeCrashReport(
      path.dirname(mockLogPath),
      parseNativeMinidump(dump),
    );
    await fs.writeFile(
      path.join(path.dirname(mockLogPath), 'crashes', 'raw.dmp'),
      'SECRET',
    );
    const digest = await api.collectLoggerDigest({
      fileBaseName: 'synthetic-export',
    });
    const bytes = await fs.readFile(digest.filePath);
    const zip = new AdmZip(bytes);
    const names = zip.getEntries().map((entry) => entry.entryName);
    expect(names).toHaveLength(2);
    expect(names).toContain('app-latest.log');
    const crash = names.find((name) => name.startsWith('crashes/'));
    expect(crash).toBeDefined();
    expect(zip.readAsText(crash ?? '')).not.toContain('SECRET');
    expect(zip.readAsText('app-latest.log')).toBe('existing ordinary log');
    expect(digest.sizeBytes).toBe(bytes.length);
    expect(digest.sha256).toBe(
      createHash('sha256').update(bytes).digest('hex'),
    );
    expect(digest.mimeType).toBe('application/zip');
    expect(mockCollect).toHaveBeenCalledTimes(1);
    await api.exportLoggerZip({ fileBaseName: 'manual-export' });
    expect(download).toHaveBeenCalledWith(
      expect.stringContaining('manual-export.zip'),
    );
  });
  test('a diagnostics failure still produces ordinary logs for existing manual/upload flows', async () => {
    mockCollect.mockRejectedValueOnce('synthetic failure');
    const result = await api.collectLoggerDigest({
      fileBaseName: 'failure-export',
    });
    expect(
      new AdmZip(await fs.readFile(result.filePath))
        .getEntries()
        .map((entry) => entry.entryName),
    ).toEqual(['app-latest.log']);
  });
});

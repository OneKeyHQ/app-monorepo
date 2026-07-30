import fs from 'fs';
import os from 'os';
import path from 'path';

import { EAppUpdatePackageAvailabilityStatus } from '@onekeyhq/shared/src/modules3rdParty/auto-update/type';

import { getDownloadedFileAvailability } from './appUpdatePackageAvailability';

describe('getDownloadedFileAvailability', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-app-update-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  test('returns missing when path is absent', () => {
    expect(getDownloadedFileAvailability()).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.missing,
    });
    expect(
      getDownloadedFileAvailability(path.join(tempDir, 'missing.zip')),
    ).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.missing,
    });
  });

  test('returns available only for a non-empty regular file', () => {
    const packagePath = path.join(tempDir, 'package.zip');
    fs.writeFileSync(packagePath, 'package');

    expect(getDownloadedFileAvailability(packagePath)).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.available,
    });
  });

  test('treats an empty file and a directory as missing', () => {
    const emptyPath = path.join(tempDir, 'empty.zip');
    fs.writeFileSync(emptyPath, '');

    expect(getDownloadedFileAvailability(emptyPath)).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.missing,
    });
    expect(getDownloadedFileAvailability(tempDir)).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.missing,
    });
  });

  test('keeps non-missing file-system failures distinct', () => {
    const error = new Error('permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    jest.spyOn(fs, 'statSync').mockImplementationOnce(() => {
      throw error;
    });

    expect(getDownloadedFileAvailability('/tmp/package.zip')).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.unavailable,
      errorCode: 'EACCES',
    });
  });
});

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

  test('requires the updater to prepare a macOS package in the current process', () => {
    const packagePath = path.join(tempDir, 'package.zip');
    fs.writeFileSync(packagePath, 'package');

    expect(
      getDownloadedFileAvailability(packagePath, {
        requireCurrentProcessPreparation: true,
      }),
    ).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.notPrepared,
    });
    expect(
      getDownloadedFileAvailability(packagePath, {
        requireCurrentProcessPreparation: true,
        preparedDownloadedFile: packagePath,
      }),
    ).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.available,
    });
  });

  test('does not accept a different package prepared in the current process', () => {
    const packagePath = path.join(tempDir, 'package.zip');
    fs.writeFileSync(packagePath, 'package');

    expect(
      getDownloadedFileAvailability(packagePath, {
        requireCurrentProcessPreparation: true,
        preparedDownloadedFile: path.join(tempDir, 'other.zip'),
      }),
    ).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.notPrepared,
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

  test('rejects a symbolic link even when its target is a valid package', () => {
    const packagePath = path.join(tempDir, 'package.zip');
    const linkPath = path.join(tempDir, 'package-link.zip');
    fs.writeFileSync(packagePath, 'package');
    fs.symlinkSync(packagePath, linkPath);

    expect(getDownloadedFileAvailability(linkPath)).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.missing,
    });
  });

  test('rejects a path replaced between lstat and fstat', () => {
    const packagePath = path.join(tempDir, 'package.zip');
    fs.writeFileSync(packagePath, 'package');
    const pathStat = fs.lstatSync(packagePath);
    jest.spyOn(fs, 'fstatSync').mockReturnValueOnce({
      dev: pathStat.dev,
      ino: pathStat.ino + 1,
      isFile: () => true,
      size: pathStat.size,
    } as fs.Stats);

    expect(getDownloadedFileAvailability(packagePath)).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.missing,
    });
  });

  test('closes the file descriptor when fstat fails', () => {
    const packagePath = path.join(tempDir, 'package.zip');
    fs.writeFileSync(packagePath, 'package');
    const error = new Error('read failure') as NodeJS.ErrnoException;
    error.code = 'EIO';
    const closeSpy = jest.spyOn(fs, 'closeSync');
    jest.spyOn(fs, 'fstatSync').mockImplementationOnce(() => {
      throw error;
    });

    expect(getDownloadedFileAvailability(packagePath)).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.unavailable,
      errorCode: 'EIO',
    });
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  test('keeps non-missing file-system failures distinct', () => {
    const error = new Error('permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    jest.spyOn(fs, 'lstatSync').mockImplementationOnce(() => {
      throw error;
    });

    expect(getDownloadedFileAvailability('/tmp/package.zip')).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.unavailable,
      errorCode: 'EACCES',
    });
  });

  test('returns unavailable when a regular file cannot be opened for reading', () => {
    const packagePath = path.join(tempDir, 'package.zip');
    fs.writeFileSync(packagePath, 'package');
    const error = new Error('permission denied') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    jest.spyOn(fs, 'openSync').mockImplementationOnce(() => {
      throw error;
    });

    expect(getDownloadedFileAvailability(packagePath)).toEqual({
      status: EAppUpdatePackageAvailabilityStatus.unavailable,
      errorCode: 'EACCES',
    });
  });
});

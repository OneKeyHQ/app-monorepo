import fs from 'fs';
import os from 'os';
import path from 'path';

import { parseNativeMinidump } from './nativeCrashMinidump';
import { MAX_NATIVE_DUMP_BYTES } from './nativeCrashReport';
import { makeSyntheticDump } from './nativeCrashTestFixture';

describe('native minidump whitelist parser', () => {
  let directory: string;
  let file: string;
  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'onekey-fixture-'));
    file = path.join(directory, 'test.dmp');
  });
  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
  function parse(buffer: Buffer) {
    fs.writeFileSync(file, buffer);
    return parseNativeMinidump(file);
  }
  function withModuleCount(count: number): Buffer {
    const dump = makeSyntheticDump(12, 0x81_01);
    const modules = Buffer.alloc(4 + count * 108);
    modules.writeUInt32LE(count, 0);
    for (let index = 0; index < count; index += 1) {
      dump.copy(modules, 4 + index * 108, 404, 512);
    }
    dump.writeUInt32LE(modules.length, 60);
    dump.writeUInt32LE(dump.length, 64);
    return Buffer.concat([dump, modules]);
  }

  test.each([1147, 4096])(
    'accepts bounded macOS module lists with %s images',
    (count) => {
      const report = parse(withModuleCount(count));
      expect(report.frames).toHaveLength(2);
      expect(report.modules).toHaveLength(1);
      expect(JSON.stringify(report)).not.toContain('SECRET');
    },
  );
  test('rejects module lists beyond the work limit', () => {
    expect(() => parse(withModuleCount(4097))).toThrow('Invalid modules');
  });

  test.each([
    [9, 2, 'x64', 'windows'],
    [9, 0x81_01, 'x64', 'macos'],
    [12, 0x81_01, 'arm64', 'macos'],
    [9, 0x82_01, 'x64', 'linux'],
    [12, 2, 'arm64', 'windows'],
    [12, 0x82_01, 'arm64', 'linux'],
  ])(
    'extracts supported %s/%s without copying sensitive streams',
    (cpu, platform, architecture, name) => {
      const report = parse(
        makeSyntheticDump(cpu as number, platform as number),
      );
      expect(report.architecture).toBe(architecture);
      expect(report.platform).toBe(name);
      expect(report.exceptionCode).toBe(0xc0_00_00_05);
      expect(report.frames).toEqual([
        { moduleIndex: 0, offset: 0x1_00, trust: 'context' },
        { moduleIndex: 0, offset: 0x2_00, trust: 'frame-pointer' },
      ]);
      expect(report.modules[0].version).toEqual([1, 2, 3, 4]);
      const output = JSON.stringify(report);
      for (const secret of [
        'SECRET',
        'wallet',
        '/Users',
        'token',
        'seed',
        '2097152',
      ])
        expect(output).not.toContain(secret);
    },
  );
  test('rejects truncated and invalid headers', () => {
    expect(() => parse(Buffer.alloc(31))).toThrow();
    const dump = makeSyntheticDump();
    dump.writeUInt32LE(0, 0);
    expect(() => parse(dump)).toThrow();
  });
  test.each([
    'stream-count',
    'directory',
    'duplicate',
    'module-count',
    'thread-count',
    'context',
    'architecture',
    'platform',
    'instruction',
    'stack',
  ])('fails closed for malformed or unsupported %s', (kind) => {
    const dump = makeSyntheticDump();
    if (kind === 'stream-count') dump.writeUInt32LE(1000, 8);
    if (kind === 'directory') dump.writeUInt32LE(0xff_ff_ff_ff, 12);
    if (kind === 'duplicate') dump.writeUInt32LE(7, 44);
    if (kind === 'module-count') dump.writeUInt32LE(10_000, 400);
    if (kind === 'thread-count') dump.writeUInt32LE(10_000, 600);
    if (kind === 'context') dump.writeUInt32LE(0, 848);
    if (kind === 'architecture') dump.writeUInt16LE(0, 100);
    if (kind === 'platform') dump.writeUInt32LE(99, 120);
    if (kind === 'instruction') dump.writeBigUInt64LE(0x90_00_00n, 1048);
    if (kind === 'stack') dump.writeUInt32LE(0xff_ff_ff_ff, 640);
    expect(() => parse(dump)).toThrow();
  });
  test('stops a cyclic frame chain', () => {
    const dump = makeSyntheticDump();
    dump.writeBigUInt64LE(0x20_00_00n, 1200);
    expect(parse(dump).frames).toHaveLength(1);
  });
  test('does not follow symbolic links or accept hard links', () => {
    const original = path.join(directory, 'original.dmp');
    fs.writeFileSync(original, makeSyntheticDump());
    fs.symlinkSync(original, file);
    expect(() => parseNativeMinidump(file)).toThrow();
    fs.unlinkSync(file);
    fs.linkSync(original, file);
    expect(() => parseNativeMinidump(file)).toThrow();
  });
  test('rejects oversized files before reading', () => {
    fs.writeFileSync(file, makeSyntheticDump());
    fs.truncateSync(file, MAX_NATIVE_DUMP_BYTES + 1);
    expect(() => parseNativeMinidump(file)).toThrow();
  });
});

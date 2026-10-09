/* eslint-disable no-continue */
/* oxlint-disable onekey/no-raw-error -- This isolated parser must not load wallet/runtime error dependencies; all error text is discarded by the worker. */
// cspell:ignore Breakpad MDRawContextAMD64 ARM64 Crashpad
import { createHash } from 'crypto';
import fs from 'fs';

import {
  MAX_NATIVE_CRASH_FRAMES,
  MAX_NATIVE_DUMP_BYTES,
} from './nativeCrashReport';

import type { INativeCrashReport } from './nativeCrashReport';

// Layouts: Microsoft MINIDUMP_* and Breakpad MDRawContextAMD64/ARM64.
// This deliberately does not implement memory scanning, CFI, symbol loading, or
// string decoding. Missing/unsupported layouts fail closed, not as "sanitized" dumps.
export function parseNativeMinidump(filePath: string): INativeCrashReport {
  const fd = fs.openSync(
    filePath,
    fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0),
  );
  try {
    const stat = fs.fstatSync(fd);
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      stat.size < 32 ||
      stat.size > MAX_NATIVE_DUMP_BYTES
    )
      throw new Error('Invalid dump');
    const read = (offset: number, size: number): Buffer => {
      if (
        !Number.isSafeInteger(offset) ||
        !Number.isSafeInteger(size) ||
        offset < 0 ||
        size < 0 ||
        size > 1024 * 1024 ||
        offset + size > stat.size
      )
        throw new Error('Invalid range');
      const buffer = Buffer.alloc(size);
      if (fs.readSync(fd, buffer, 0, size, offset) !== size)
        throw new Error('Short read');
      return buffer;
    };
    const header = read(0, 32);
    if (
      header.readUInt32LE(0) !== 0x50_4d_44_4d ||
      (header.readUInt32LE(4) & 0xff_ff) !== 0xa7_93
    )
      throw new Error('Unsupported dump');
    const count = header.readUInt32LE(8);
    if (count === 0 || count > 64) throw new Error('Invalid streams');
    const directories = read(header.readUInt32LE(12), count * 12);
    const streams = new Map<number, { offset: number; size: number }>();
    for (let index = 0; index < count; index += 1) {
      const type = directories.readUInt32LE(index * 12);
      if (![3, 4, 6, 7].includes(type)) continue;
      if (streams.has(type)) throw new Error('Duplicate stream');
      const size = directories.readUInt32LE(index * 12 + 4);
      const offset = directories.readUInt32LE(index * 12 + 8);
      if (offset + size > stat.size) throw new Error('Invalid stream');
      streams.set(type, { offset, size });
    }
    const stream = (type: number, minimumSize: number) => {
      const entry = streams.get(type);
      if (!entry || entry.size < minimumSize) throw new Error('Missing stream');
      return entry;
    };
    const system = read(stream(7, 32).offset, 32);
    const cpu = system.readUInt16LE(0);
    const os = system.readUInt32LE(20);
    const architectures = new Map<number, INativeCrashReport['architecture']>([
      [9, 'x64'],
      [12, 'arm64'],
    ]);
    const architecture = architectures.get(cpu);
    const platforms = new Map<number, INativeCrashReport['platform']>([
      [2, 'windows'],
      [0x81_01, 'macos'],
      [0x82_01, 'linux'],
    ]);
    const platform = platforms.get(os);
    if (!architecture || !platform) throw new Error('Unsupported platform');

    const exception = read(stream(6, 168).offset, 168);
    const contextSize = exception.readUInt32LE(160);
    const context = read(
      exception.readUInt32LE(164),
      Math.min(contextSize, 272),
    );
    const flagsOffset = architecture === 'x64' ? 48 : 0;
    const requiredFlags = architecture === 'x64' ? 0x10_00_03 : 0x40_00_03;
    if (
      context.length < (architecture === 'x64' ? 256 : 272) ||
      (context.readUInt32LE(flagsOffset) & requiredFlags) !== requiredFlags
    )
      throw new Error('Unsupported context');
    const ip = context.readBigUInt64LE(architecture === 'x64' ? 248 : 264);
    let fp = context.readBigUInt64LE(architecture === 'x64' ? 160 : 240);
    const sp = context.readBigUInt64LE(architecture === 'x64' ? 152 : 256);

    const moduleStream = stream(4, 4);
    const moduleCount = read(moduleStream.offset, 4).readUInt32LE(0);
    if (moduleCount > 1024 || 4 + moduleCount * 108 > moduleStream.size)
      throw new Error('Invalid modules');
    const images: {
      base: bigint;
      size: number;
      id: string;
      version: number[];
    }[] = [];
    for (let index = 0; index < moduleCount; index += 1) {
      const module = read(moduleStream.offset + 4 + index * 108, 108);
      const size = module.readUInt32LE(8);
      if (size === 0) continue;
      // Hash only fixed binary identifiers; never read the module name/PDB path.
      const hash = createHash('sha256')
        .update(module.subarray(8, 20))
        .update(module.subarray(32, 40));
      const cvSize = module.readUInt32LE(76);
      const cvOffset = module.readUInt32LE(80);
      if (cvSize >= 20 && cvSize <= 4096) {
        const signature = read(cvOffset, 4).readUInt32LE(0);
        if (signature === 0x53_44_53_52 && cvSize >= 24)
          hash.update(read(cvOffset + 4, 20));
        else if (signature === 0x42_70_45_4c && cvSize <= 68)
          hash.update(read(cvOffset + 4, cvSize - 4));
      }
      const versionHigh = module.readUInt32LE(32);
      const versionLow = module.readUInt32LE(36);
      images.push({
        base: module.readBigUInt64LE(0),
        size,
        id: hash.digest('hex'),
        version: [
          versionHigh >>> 16,
          versionHigh & 0xff_ff,
          versionLow >>> 16,
          versionLow & 0xff_ff,
        ],
      });
    }
    const report: INativeCrashReport = {
      source: 'electron-native',
      schemaVersion: 1,
      collectedAt: Date.now(),
      platform,
      architecture,
      exceptionCode: exception.readUInt32LE(8),
      stackMethod: 'frame-pointer',
      modules: [],
      frames: [],
    };
    const addFrame = (
      address: bigint,
      trust: 'context' | 'frame-pointer',
    ): boolean => {
      const image = images.find(
        (item) =>
          address >= item.base && address - item.base < BigInt(item.size),
      );
      if (!image) return false;
      let moduleIndex = report.modules.findIndex(
        (item) => item.id === image.id,
      );
      if (moduleIndex === -1) {
        moduleIndex = report.modules.length;
        report.modules.push({
          id: image.id,
          size: image.size,
          version: image.version,
        });
      }
      report.frames.push({
        moduleIndex,
        offset: Number(address - image.base),
        trust,
      });
      return true;
    };
    if (!addFrame(ip, 'context')) throw new Error('Unmapped instruction');

    const threads = stream(3, 4);
    const threadCount = read(threads.offset, 4).readUInt32LE(0);
    if (threadCount > 1024 || 4 + threadCount * 48 > threads.size)
      throw new Error('Invalid threads');
    for (let index = 0; index < threadCount; index += 1) {
      const thread = read(threads.offset + 4 + index * 48, 48);
      if (thread.readUInt32LE(0) !== exception.readUInt32LE(0)) continue;
      const stackBase = thread.readBigUInt64LE(24);
      const stackSize = thread.readUInt32LE(32);
      const stackOffset = thread.readUInt32LE(36);
      if (stackOffset + stackSize > stat.size) throw new Error('Invalid stack');
      // Read only the two pointer slots of a linked frame record. Never scan
      // stack words for plausible addresses or emit other register values.
      while (
        report.frames.length < MAX_NATIVE_CRASH_FRAMES &&
        fp >= sp &&
        fp >= stackBase &&
        fp + 16n <= stackBase + BigInt(stackSize) &&
        fp % 8n === 0n
      ) {
        const frame = read(stackOffset + Number(fp - stackBase), 16);
        const nextFp = frame.readBigUInt64LE(0);
        const returnAddress = frame.readBigUInt64LE(8);
        if (nextFp <= fp || !addFrame(returnAddress, 'frame-pointer')) break;
        fp = nextFp;
      }
      break;
    }
    return report;
  } finally {
    fs.closeSync(fd);
  }
}

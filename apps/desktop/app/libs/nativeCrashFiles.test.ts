import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import AdmZip from 'adm-zip';

import {
  readNativeCrashReports,
  writeNativeCrashReport,
} from './nativeCrashFiles';
import { parseNativeMinidump } from './nativeCrashMinidump';
import {
  NATIVE_CRASH_REPORT_AGE_MS,
  sanitizeNativeCrashReport,
} from './nativeCrashReport';
import { makeSyntheticDump } from './nativeCrashTestFixture';

describe('native crash report storage and export', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'onekey-crash-fixture-'),
    );
  });
  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true });
  });
  async function fixture() {
    const dump = path.join(directory, 'synthetic.dmp');
    await fs.writeFile(dump, makeSyntheticDump());
    return parseNativeMinidump(dump);
  }

  test('persists with restricted mode, reconstructs JSON, and exports no raw memory', async () => {
    const report = await fixture();
    await writeNativeCrashReport(directory, report);
    const [entry] = await readNativeCrashReports(directory);
    const zip = new AdmZip();
    zip.addFile('app-latest.log', Buffer.from('ordinary log'));
    zip.addFile(`crashes/${entry.name}`, entry.data);
    const result = new AdmZip(zip.toBuffer());
    expect(result.getEntries().map((item) => item.entryName)).toEqual([
      'app-latest.log',
      `crashes/${entry.name}`,
    ]);
    expect(JSON.parse(result.readAsText(`crashes/${entry.name}`))).toEqual(
      report,
    );
    expect(result.readAsText(`crashes/${entry.name}`)).not.toContain('SECRET');
    expect(
      (await fs.stat(path.join(directory, 'crashes', entry.name))).mode & 0o777,
    ).toBe(0o600);
  });
  test('limits count to five and removes expired/future reports', async () => {
    const report = await fixture();
    const now = Date.now();
    for (let index = 0; index < 7; index += 1)
      await writeNativeCrashReport(directory, {
        ...report,
        collectedAt: now - index,
      });
    await writeNativeCrashReport(directory, {
      ...report,
      collectedAt: now - NATIVE_CRASH_REPORT_AGE_MS - 1,
    });
    await writeNativeCrashReport(directory, {
      ...report,
      collectedAt: now + 10_000,
    });
    const entries = await readNativeCrashReports(directory, now);
    expect(
      entries.map(
        (entry) =>
          (JSON.parse(entry.data.toString()) as { collectedAt: number })
            .collectedAt,
      ),
    ).toEqual([now, now - 1, now - 2, now - 3, now - 4]);
    expect(await fs.readdir(path.join(directory, 'crashes'))).toHaveLength(5);
  });
  test('reconstructs injected unknown fields and rejects malformed report values', async () => {
    const report = await fixture();
    const dirty = {
      ...report,
      token: 'SECRET',
      memory: 'SEED',
      modules: report.modules.map((module) => ({
        ...module,
        path: '/Users/private',
      })),
    };
    expect(sanitizeNativeCrashReport(dirty)).toEqual(report);
    expect(
      sanitizeNativeCrashReport({ ...report, platform: { toString: null } }),
    ).toBeUndefined();
    expect(
      sanitizeNativeCrashReport({ ...report, exceptionCode: NaN }),
    ).toBeUndefined();
    expect(
      sanitizeNativeCrashReport({
        ...report,
        frames: [{ moduleIndex: 999, offset: 0, trust: 'context' }],
      }),
    ).toBeUndefined();
    expect(
      sanitizeNativeCrashReport({
        ...report,
        frames: Array(33).fill(report.frames[0]),
      }),
    ).toBeUndefined();
    const folder = path.join(directory, 'crashes');
    await fs.mkdir(folder);
    const name = 'native-00000000-0000-0000-0000-000000000001.json';
    await fs.writeFile(path.join(folder, name), JSON.stringify(dirty));
    const [entry] = await readNativeCrashReports(directory);
    expect(JSON.parse(entry.data.toString())).toEqual(report);
  });
  test('ignores unrelated/raw files and does not follow report symlinks', async () => {
    const report = await fixture();
    await writeNativeCrashReport(directory, report);
    const folder = path.join(directory, 'crashes');
    await fs.writeFile(path.join(folder, 'raw.dmp'), 'SECRET');
    await fs.writeFile(path.join(folder, 'unrelated.json'), 'SECRET');
    const target = path.join(directory, 'private.json');
    await fs.writeFile(target, 'SECRET');
    await fs.symlink(
      target,
      path.join(folder, 'native-00000000-0000-0000-0000-000000000001.json'),
    );
    const entries = await readNativeCrashReports(directory);
    expect(entries).toHaveLength(1);
    expect(await fs.readFile(target, 'utf8')).toBe('SECRET');
    expect(await fs.readFile(path.join(folder, 'raw.dmp'), 'utf8')).toBe(
      'SECRET',
    );
  });
  test('rejects an oversized or malformed stored report without breaking exports', async () => {
    const folder = path.join(directory, 'crashes');
    await fs.mkdir(folder);
    await fs.writeFile(
      path.join(folder, 'native-00000000-0000-0000-0000-000000000001.json'),
      Buffer.alloc(20_000),
    );
    await fs.writeFile(
      path.join(folder, 'native-00000000-0000-0000-0000-000000000002.json'),
      'not json',
    );
    expect(await readNativeCrashReports(directory)).toEqual([]);
  });
  test('rejects a symlinked report directory', async () => {
    const outside = path.join(directory, 'outside');
    await fs.mkdir(outside);
    await fs.symlink(outside, path.join(directory, 'crashes'));
    await expect(readNativeCrashReports(directory)).rejects.toThrow();
    expect(await fs.readdir(outside)).toEqual([]);
  });
});

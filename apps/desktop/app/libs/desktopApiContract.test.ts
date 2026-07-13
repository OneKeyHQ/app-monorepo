/* eslint-disable import/first */
// Drift-detection contract test between:
//   - packages/shared/src/platformEnv.ts        (reader)
//   - apps/desktop/app/libs/registerInfoHandlers.ts (IPC writer for renderer)
//   - apps/desktop/app/libs/react-native-mock.ts    (globalThis writer for main)
//
// Layered safety model:
//   1. Compile time — both writers are typed against IDesktopApiPlatformInfo /
//      IDesktopApiGlobal in `packages/shared/types/desktopApiPlatformInfo.ts`,
//      and IDesktopApiLegacy (the `globalThis.desktopApi` type) extends
//      IDesktopApiGlobal, so platformEnv's reads stay type-checked via the
//      existing `@types/globals.d.ts` augmentation. Missing or renamed fields
//      fail `tsc:staged`.
//   2. Runtime (this test) — belt-and-suspenders. Verifies both builders
//      actually produce the full required key set at runtime, so a field that
//      only type-checks via `any` / optional would still be caught.

jest.mock('electron', () => ({
  ipcMain: {
    removeAllListeners: jest.fn(),
    on: jest.fn(),
  },
}));

jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  transports: { file: { getFile: () => ({ path: '/tmp/onekey.log' }) } },
}));

import { buildDesktopApiGlobal } from './react-native-mock';
import { buildPlatformInfoForIpc } from './registerInfoHandlers';

// Fields platformEnv.ts reads from `globalThis.desktopApi`. Kept in sync
// manually — if platformEnv adds a new read, add it here and the writers'
// types will force the writers to provide it.
const PLATFORM_ENV_READS = [
  'platform',
  'arch',
  'systemVersion',
  'channel',
  'deskChannel',
  'isMas',
] as const;

describe('desktopApi contract', () => {
  it('IPC payload has all fields platformEnv reads', () => {
    const info = buildPlatformInfoForIpc();
    const keys = Object.keys(info);
    for (const required of PLATFORM_ENV_READS) {
      expect(keys).toContain(required);
    }
  });

  it('main-process mock has all fields platformEnv reads + isDev', () => {
    const info = buildDesktopApiGlobal();
    const keys = Object.keys(info);
    for (const required of [...PLATFORM_ENV_READS, 'isDev'] as const) {
      expect(keys).toContain(required);
    }
  });

  it('IPC payload shape is a subset of the main-process mock shape', () => {
    // The mock populates `globalThis.desktopApi` in the main-process bundle;
    // the renderer gets the same fields via IPC (plus `isDev` via a separate
    // IPC call). Any field in IPC must also be in the mock.
    const ipcKeys = new Set(Object.keys(buildPlatformInfoForIpc()));
    const mockKeys = new Set(Object.keys(buildDesktopApiGlobal()));
    for (const key of ipcKeys) {
      expect(mockKeys.has(key)).toBe(true);
    }
  });

  it('field values are of the expected primitive types', () => {
    const info = buildDesktopApiGlobal();
    expect(typeof info.platform).toBe('string');
    expect(typeof info.arch).toBe('string');
    expect(typeof info.systemVersion).toBe('string');
    expect(typeof info.deskChannel).toBe('string');
    expect(typeof info.isMas).toBe('boolean');
    expect(typeof info.isDev).toBe('boolean');
    // `processStartAt` is required (epoch ms of process creation). In the
    // non-Electron test env `process.getCreationTime` is undefined, so the
    // builder falls back to `Date.now()` — still a positive number. Asserting
    // > 0 also guards the fallback path itself.
    expect(typeof info.processStartAt).toBe('number');
    expect(info.processStartAt).toBeGreaterThan(0);
    // `channel` is optional — may be undefined outside Linux
    if (info.channel !== undefined) {
      expect(typeof info.channel).toBe('string');
    }
  });
});

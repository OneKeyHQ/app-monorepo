/* eslint-disable import/first */
import fs from 'fs';
import path from 'path';

import Store from 'electron-store';
import ts from 'typescript';

import DesktopApiStorage from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiStorage';
import type { IDesktopApi } from '@onekeyhq/kit-bg/src/desktopApis/instance/IDesktopApi';
import { EDesktopStoreKeys } from '@onekeyhq/shared/types/desktop';

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/later-app-name') },
  safeStorage: { isEncryptionAvailable: jest.fn(() => false) },
}));

jest.mock('electron-log/main', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

jest.mock('electron-store', () => ({
  __esModule: true,
  default: jest.fn(({ name, cwd }: { name: string; cwd?: string }) => {
    const data = new Map<string, unknown>();
    return {
      path: path.join(cwd ?? '/original-profile', `${name}.json`),
      data,
      get: jest.fn((key: string, defaultValue?: unknown) =>
        data.has(key) ? data.get(key) : defaultValue,
      ),
      set: jest.fn((key: string, value: unknown) => data.set(key, value)),
      delete: jest.fn((key: string) => data.delete(key)),
      clear: jest.fn(() => data.clear()),
    };
  }),
}));

import * as store from './store';

type IStoreMock = {
  path: string;
  data: Map<string, unknown>;
  get: jest.Mock;
  set: jest.Mock;
  delete: jest.Mock;
  clear: jest.Mock;
};

const stores = jest
  .mocked(Store)
  .mock.results.map((result) => result.value as IStoreMock);
const [preferences, updates, runtime, mmkv] = stores;

// Frozen legacy field list. New fields must use a dedicated store.
const ONEKEY_FIELDS = [
  'WinBounds',
  'UpdateSettings',
  'DevTools',
  'Theme',
  'EncryptedData',
  'Language',
  'DisableKeyboardShortcuts',
  'AppInstanceMetaBackup',
  'NetworkThrottle',
];

function visit(node: ts.Node, callback: (child: ts.Node) => void) {
  callback(node);
  ts.forEachChild(node, (child) => visit(child, callback));
}

describe('desktop store file boundaries', () => {
  beforeEach(() => {
    for (const entry of stores) {
      entry.data.clear();
      entry.get.mockClear();
      entry.set.mockClear();
      entry.delete.mockClear();
      entry.clear.mockClear();
    }
  });

  it('creates state files beside the actual OneKey.json path', () => {
    expect(updates.path).toBe(
      path.join(path.dirname(preferences.path), 'OneKey-update-state.json'),
    );
    expect(runtime.path).toBe(
      path.join(path.dirname(preferences.path), 'OneKey-runtime-state.json'),
    );
  });

  it('isolates updater and crash writes from preferences and encrypted data', () => {
    preferences.data.set(EDesktopStoreKeys.EncryptedData, {
      fixture: 'opaque-test-ciphertext',
    });
    store.setNativeVersion('6.7.0');
    store.setUpdateBundleData({
      appVersion: '6.7.0',
      bundleVersion: '2',
      signature: 'test-signature',
    });
    store.recordGPUCrash();
    expect(store.incrementConsecutiveBootFailCount()).toBe(1);
    expect(store.getGPUCrashStats().count).toBe(1);
    expect(updates.data.get(EDesktopStoreKeys.NativeVersion)).toBe('6.7.0');
    expect(runtime.data.get(EDesktopStoreKeys.ConsecutiveBootFailCount)).toBe(
      1,
    );
    expect(preferences.set).not.toHaveBeenCalled();
    expect(preferences.data.get(EDesktopStoreKeys.EncryptedData)).toEqual({
      fixture: 'opaque-test-ciphertext',
    });
  });

  it('routes generic storage access to the same files as dedicated accessors', () => {
    expect(store.getStoreForKey(EDesktopStoreKeys.Theme)).toBe(store.instance);
    expect(store.getStoreForKey(EDesktopStoreKeys.UpdateBundleData)).toBe(
      store.getStoreForKey(EDesktopStoreKeys.ASCFile),
    );
    expect(store.getStoreForKey(EDesktopStoreKeys.UpdateBundleData).path).toBe(
      updates.path,
    );
    expect(store.getStoreForKey(EDesktopStoreKeys.GPUCrashCount).path).toBe(
      runtime.path,
    );
    store
      .getStoreForKey(EDesktopStoreKeys.BootFailAppVersion)
      .set(EDesktopStoreKeys.BootFailAppVersion, '6.7.0');
    expect(store.getBootFailAppVersion()).toBe('6.7.0');
  });

  it('starts new state files with defaults rather than reading legacy state', () => {
    preferences.data.set(EDesktopStoreKeys.GPUCrashCount, 9);
    preferences.data.set(EDesktopStoreKeys.ConsecutiveBootFailCount, 5);
    preferences.data.set(EDesktopStoreKeys.UpdateBundleData, {
      appVersion: '6.6.1',
      bundleVersion: '1',
      signature: 'legacy-test-signature',
    });
    expect(store.getGPUCrashStats()).toEqual({ count: 0, lastCrashTime: 0 });
    expect(store.getConsecutiveBootFailCount()).toBe(0);
    expect(store.getUpdateBundleData()).toEqual({});
    expect(preferences.get).not.toHaveBeenCalled();
  });

  it('clears all three desktop files without clearing MMKV settings', () => {
    for (const entry of stores) entry.data.set('fixture', true);
    store.clear();
    expect(preferences.clear).toHaveBeenCalledTimes(1);
    expect(updates.clear).toHaveBeenCalledTimes(1);
    expect(runtime.clear).toHaveBeenCalledTimes(1);
    expect(mmkv.clear).not.toHaveBeenCalled();
    expect(mmkv.data.get('fixture')).toBe(true);
  });

  it('statically rejects new OneKey.json fields and direct access to other fields', () => {
    const source = ts.createSourceFile(
      'store.ts',
      fs.readFileSync(path.join(__dirname, 'store.ts'), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const routedFields: string[] = [];
    const directFields: string[] = [];
    visit(source, (node) => {
      if (
        ts.isVariableDeclaration(node) &&
        node.name.getText(source) === 'storeByKey'
      ) {
        visit(node, (child) => {
          if (
            ts.isPropertyAssignment(child) &&
            child.initializer.getText(source) === 'store'
          ) {
            routedFields.push(child.name.getText(source));
          }
        });
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.expression.getText(source) === 'store' &&
        ['get', 'set', 'delete', 'has', 'reset'].includes(
          node.expression.name.text,
        )
      ) {
        directFields.push(node.arguments[0]?.getText(source) ?? '');
      }
    });
    expect(routedFields.toSorted()).toEqual(
      ONEKEY_FIELDS.map((field) => `[EDesktopStoreKeys.${field}]`).toSorted(),
    );
    const allowedDirectFields = ONEKEY_FIELDS.map(
      (field) => `EDesktopStoreKeys.${field}`,
    );
    for (const field of directFields) {
      expect(allowedDirectFields).toContain(field);
    }
  });

  it('routes generic IPC reads, writes, deletes and clears across the files', async () => {
    const api = new DesktopApiStorage({ desktopApi: {} as IDesktopApi });
    await api.storeSetItemAsync(
      EDesktopStoreKeys.UpdateBuildNumber,
      'test-build',
    );
    await api.storeSetItemAsync(EDesktopStoreKeys.GPUCrashCount, 3);
    await api.storeSetItemAsync(EDesktopStoreKeys.Theme, 'dark');
    expect(updates.data.get(EDesktopStoreKeys.UpdateBuildNumber)).toBe(
      'test-build',
    );
    expect(runtime.data.get(EDesktopStoreKeys.GPUCrashCount)).toBe(3);
    expect(preferences.data.get(EDesktopStoreKeys.Theme)).toBe('dark');
    expect(preferences.data.has(EDesktopStoreKeys.GPUCrashCount)).toBe(false);
    expect(await api.storeGetItemAsync(EDesktopStoreKeys.GPUCrashCount)).toBe(
      3,
    );
    await api.storeDelItemAsync(EDesktopStoreKeys.UpdateBuildNumber);
    expect(updates.data.has(EDesktopStoreKeys.UpdateBuildNumber)).toBe(false);
    await api.storeClear();
    expect(preferences.data.size).toBe(0);
    expect(updates.data.size).toBe(0);
    expect(runtime.data.size).toBe(0);
  });
});

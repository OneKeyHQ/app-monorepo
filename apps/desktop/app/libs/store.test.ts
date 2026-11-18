/* eslint-disable import/first */
import fs from 'fs';
import path from 'path';

import { parse } from '@babel/parser';
import Store from 'electron-store';

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
] as const satisfies readonly (keyof typeof EDesktopStoreKeys)[];

type IAstNode = {
  type?: string;
  start?: number | null;
  end?: number | null;
  [key: string]: unknown;
};

const isAstNode = (value: unknown): value is IAstNode =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IAstNode).type === 'string';

const getAstNodeText = (source: string, node: IAstNode): string =>
  source.slice(node.start ?? 0, node.end ?? 0);

const getIdentifierName = (node: IAstNode | undefined): string | undefined =>
  node?.type === 'Identifier' && typeof node.name === 'string'
    ? node.name
    : undefined;

const forEachAstNode = (node: IAstNode, visit: (node: IAstNode) => void) => {
  visit(node);
  for (const key of Object.keys(node)) {
    if (!['loc', 'start', 'end', 'extra'].includes(key)) {
      const value = node[key];
      if (Array.isArray(value)) {
        for (const item of value) {
          if (isAstNode(item)) {
            forEachAstNode(item, visit);
          }
        }
      } else if (isAstNode(value)) {
        forEachAstNode(value, visit);
      }
    }
  }
};

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

  it('statically keeps OneKey.json to the frozen field list and rejects direct access to other fields', () => {
    const frozenKeys = ONEKEY_FIELDS.map((field) => EDesktopStoreKeys[field]);
    // Runtime boundary: only the frozen fields are routed to the shared
    // OneKey.json store instance.
    expect(
      Object.values(EDesktopStoreKeys)
        .filter(
          (key) =>
            store.getStoreForKey(
              key as Parameters<typeof store.getStoreForKey>[0],
            ) === store.instance,
        )
        .toSorted(),
    ).toEqual([...frozenKeys].toSorted());

    // Static boundary: `storeByKey` must route exactly the frozen fields to the
    // shared store, and direct store.get/set/delete/has/reset calls must only
    // use those fields.
    const storeSource = fs.readFileSync(
      path.join(__dirname, 'store.ts'),
      'utf8',
    );
    const { program } = parse(storeSource, {
      sourceType: 'module',
      plugins: ['typescript'],
    }) as unknown as { program: IAstNode };
    const routedFields: string[] = [];
    const directFields: string[] = [];

    forEachAstNode(program, (node) => {
      if (
        node.type === 'VariableDeclarator' &&
        getIdentifierName(node.id as IAstNode | undefined) === 'storeByKey'
      ) {
        let init = node.init as IAstNode | undefined;
        // `storeByKey` is wrapped in `satisfies Record<...>`; unwrap TS
        // expression wrappers to reach the object literal.
        while (
          init &&
          [
            'TSSatisfiesExpression',
            'TSAsExpression',
            'TSNonNullExpression',
          ].includes(init.type ?? '')
        ) {
          init = init.expression as IAstNode | undefined;
        }
        if (init?.type === 'ObjectExpression') {
          for (const rawProperty of init.properties as unknown[]) {
            if (
              isAstNode(rawProperty) &&
              rawProperty.type === 'ObjectProperty'
            ) {
              const value = rawProperty.value as IAstNode;
              if (value.type === 'Identifier' && value.name === 'store') {
                const key = rawProperty.key as IAstNode;
                const keyText = getAstNodeText(storeSource, key);
                routedFields.push(
                  rawProperty.computed ? `[${keyText}]` : keyText,
                );
              }
            }
          }
        }
      }

      if (node.type === 'CallExpression') {
        const callee = node.callee as IAstNode;
        const propertyName =
          callee?.type === 'MemberExpression' &&
          callee.computed === false &&
          getIdentifierName(callee.object as IAstNode | undefined) === 'store'
            ? getIdentifierName(callee.property as IAstNode | undefined)
            : undefined;
        if (
          propertyName &&
          ['get', 'set', 'delete', 'has', 'reset'].includes(propertyName)
        ) {
          const [firstArgument] = node.arguments as unknown[];
          if (isAstNode(firstArgument)) {
            directFields.push(getAstNodeText(storeSource, firstArgument));
          }
        }
      }
    });

    expect(routedFields.toSorted()).toEqual(
      ONEKEY_FIELDS.map((field) => `[EDesktopStoreKeys.${field}]`).toSorted(),
    );
    const allowedDirectFields = ONEKEY_FIELDS.map(
      (field) => `EDesktopStoreKeys.${field}`,
    );
    expect(directFields.length).toBeGreaterThan(0);
    for (const field of directFields) {
      expect(allowedDirectFields).toContain(field);
    }
  });

  it('limits IPC to instance backup and resets all dedicated configuration stores', async () => {
    const api = new DesktopApiStorage({ desktopApi: {} as IDesktopApi });
    const backup = {
      instanceId: 'fixture',
      sensitiveEncodeKey: 'fixture',
      instanceIdBackup: undefined,
    };
    store.setUpdateBuildNumber('test-build');
    store.recordGPUCrash();
    store.setTheme('dark');
    await api.storeSetItemAsync(
      EDesktopStoreKeys.AppInstanceMetaBackup,
      backup,
    );
    expect(updates.data.get(EDesktopStoreKeys.UpdateBuildNumber)).toBe(
      'test-build',
    );
    expect(runtime.data.get(EDesktopStoreKeys.GPUCrashCount)).toBe(1);
    expect(preferences.data.get(EDesktopStoreKeys.Theme)).toBe('dark');
    expect(
      await api.storeGetItemAsync(EDesktopStoreKeys.AppInstanceMetaBackup),
    ).toEqual(backup);
    await expect(
      Reflect.apply(api.storeGetItemAsync.bind(api), api, [
        EDesktopStoreKeys.GPUCrashCount,
      ]),
    ).rejects.toThrow('not allowed');
    await api.storeDelItemAsync(EDesktopStoreKeys.AppInstanceMetaBackup);
    expect(preferences.data.has(EDesktopStoreKeys.AppInstanceMetaBackup)).toBe(
      false,
    );
    await api.resetAppConfiguration();
    expect(preferences.data.size).toBe(0);
    expect(updates.data.size).toBe(0);
    expect(runtime.data.size).toBe(0);
  });
});

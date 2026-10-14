import { EDesktopStoreKeys } from '@onekeyhq/shared/types/desktop';

import { isDesktopApiMethodAllowed } from './desktopApiMethodPolicy';
import DesktopApiStorage from './DesktopApiStorage';

import type { IDesktopApi } from './instance/IDesktopApi';

const mockStore = {
  set: jest.fn(),
  get: jest.fn(),
  delete: jest.fn(),
  clear: jest.fn(),
};
jest.mock('@onekeyhq/desktop/app/libs/store', () => ({
  getStoreForKey: () => mockStore,
  clear: () => {
    mockStore.clear();
  },
}));

const api = new DesktopApiStorage({ desktopApi: {} as IDesktopApi });
const backup = {
  instanceId: 'fixture',
  sensitiveEncodeKey: 'fixture',
  instanceIdBackup: undefined,
};
beforeEach(() => jest.clearAllMocks());

test('allows the instance metadata backup used by database backup', async () => {
  const key = EDesktopStoreKeys.AppInstanceMetaBackup;
  mockStore.get.mockReturnValue(backup);
  await api.storeSetItemAsync(key, backup);
  expect(await api.storeGetItemAsync(key)).toEqual(backup);
  await api.storeDelItemAsync(key);
  expect(mockStore.set).toHaveBeenCalledWith(key, backup);
  expect(mockStore.delete).toHaveBeenCalledWith(key);
});

test.each([
  'ascFile',
  'updateSettings',
  'updateBundleData',
  'fallbackUpdateBundleData',
  'devTools',
  '__proto__',
  'arbitrary',
  null,
])('rejects key %s before accessing storage', async (key) => {
  await expect(
    Reflect.apply(api.storeSetItemAsync.bind(api), api, [key, backup]),
  ).rejects.toThrow('not allowed');
  await expect(
    Reflect.apply(api.storeGetItemAsync.bind(api), api, [key]),
  ).rejects.toThrow('not allowed');
  await expect(
    Reflect.apply(api.storeDelItemAsync.bind(api), api, [key]),
  ).rejects.toThrow('not allowed');
  expect(mockStore.set).not.toHaveBeenCalled();
  expect(mockStore.get).not.toHaveBeenCalled();
  expect(mockStore.delete).not.toHaveBeenCalled();
});

test('exposes a semantic app reset instead of a generic store clear', async () => {
  expect(isDesktopApiMethodAllowed('storage', 'storeClear')).toBe(false);
  expect(isDesktopApiMethodAllowed('storage', 'resetAppConfiguration')).toBe(
    true,
  );
  await api.resetAppConfiguration();
  expect(mockStore.clear).toHaveBeenCalledTimes(1);
});

import platformEnv from '../platformEnv';

import {
  BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY,
  createHomeTokenRequest,
  createHomeTokenRequestInvalidation,
  getAdvertisedHomeTokenMainRuntimeId,
  getHomeTokenMainRuntimeId,
  isHomeTokenRequestCurrent,
  retireHomeTokenRequest,
} from './homeTokenRequest';

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, enableNativeBackgroundThread: true },
}));
const mockSharedStore = new Map<string, string>();
jest.mock(
  '../modules3rdParty/react-native-background-thread/sharedStore',
  () => ({
    getBackgroundThreadSharedStore: () => ({
      get: (key: string) => mockSharedStore.get(key),
    }),
  }),
);

describe('main Home request stamps', () => {
  beforeEach(() => {
    platformEnv.isNative = true;
    platformEnv.enableNativeBackgroundThread = true;
    mockSharedStore.clear();
  });

  it('allocates monotonic stamps synchronously and locally retires the old round', () => {
    const first = createHomeTokenRequest('owner-a');
    expect(isHomeTokenRequestCurrent(first)).toBe(true);
    const invalidation = createHomeTokenRequestInvalidation();
    expect(invalidation?.generation).toBe((first?.generation ?? 0) + 1);
    expect(isHomeTokenRequestCurrent(first)).toBe(false);
    const next = createHomeTokenRequest('owner-b');
    expect(next?.generation).toBe((invalidation?.generation ?? 0) + 1);
    expect(next?.mainRuntimeId).toBe(first?.mainRuntimeId);
    expect(isHomeTokenRequestCurrent(next)).toBe(true);
    expect(isHomeTokenRequestCurrent(undefined)).toBe(false);
  });

  it('reads the currently advertised native main identity without a bridge RPC or cached wake', () => {
    const key = BACKGROUND_THREAD_MAIN_CAPABILITIES_KEY;
    expect(getAdvertisedHomeTokenMainRuntimeId()).toBeUndefined();
    mockSharedStore.set(
      key,
      JSON.stringify({
        mainRuntimeId: getHomeTokenMainRuntimeId(),
        jotaiStateBatch: true,
      }),
    );
    expect(getAdvertisedHomeTokenMainRuntimeId()).toBe(
      getHomeTokenMainRuntimeId(),
    );
    mockSharedStore.set(
      key,
      JSON.stringify({ mainRuntimeId: 'reloaded-main' }),
    );
    expect(getAdvertisedHomeTokenMainRuntimeId()).toBe('reloaded-main');
    mockSharedStore.delete(key);
    expect(getAdvertisedHomeTokenMainRuntimeId()).toBeUndefined();
  });

  it('retires an exact unmounted round locally without retiring a newer mount', () => {
    const old = createHomeTokenRequest('owner-a');
    const current = createHomeTokenRequest('owner-a');
    retireHomeTokenRequest(old);
    expect(isHomeTokenRequestCurrent(current)).toBe(true);
    retireHomeTokenRequest(current);
    expect(isHomeTokenRequestCurrent(current)).toBe(false);
    const next = createHomeTokenRequest('owner-a');
    expect(next?.generation).toBe((current?.generation ?? 0) + 2);
    expect(isHomeTokenRequestCurrent(next)).toBe(true);
  });

  it('does not activate the protocol for desktop, web, extension or native standalone', () => {
    platformEnv.isNative = false;
    expect(createHomeTokenRequest('owner')).toBeUndefined();
    expect(createHomeTokenRequestInvalidation()).toBeUndefined();
    expect(isHomeTokenRequestCurrent()).toBe(true);
    platformEnv.isNative = true;
    platformEnv.enableNativeBackgroundThread = false;
    expect(createHomeTokenRequest('owner')).toBeUndefined();
    expect(isHomeTokenRequestCurrent()).toBe(true);
  });
});

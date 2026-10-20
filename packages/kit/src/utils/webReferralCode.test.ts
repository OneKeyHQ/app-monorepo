import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import type * as WebReferralCode from './webReferralCode';

const originalStorage = Object.getOwnPropertyDescriptor(
  globalThis,
  'sessionStorage',
);

function createStorage() {
  const values = new Map<string, string>();
  return {
    values,
    storage: {
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => values.set(key, value)),
      removeItem: jest.fn((key: string) => values.delete(key)),
    },
  };
}

function useStorage(storage: ReturnType<typeof createStorage>['storage']) {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: storage,
  });
}

function loadModule(): typeof WebReferralCode {
  let module: typeof WebReferralCode | undefined;
  jest.isolateModules(() => {
    module = require('./webReferralCode') as typeof WebReferralCode;
  });
  if (!module) throw new OneKeyLocalError('Referral module did not load');
  return module;
}

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-20T00:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
  if (originalStorage) {
    Object.defineProperty(globalThis, 'sessionStorage', originalStorage);
  } else {
    Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});

it('retains a code captured before subscription without extending its TTL', () => {
  const { storage } = createStorage();
  useStorage(storage);
  const referral = loadModule();
  referral.captureWebReferralCode(' ABC123 ');
  const captured = referral.readWebReferralCode();
  jest.runAllTicks();
  const onChange = jest.fn();
  referral.subscribeWebReferralCode(onChange);
  jest.advanceTimersByTime(20 * 24 * 60 * 60 * 1000);
  referral.captureWebReferralCode('ABC123');
  expect(referral.readWebReferralCode()).toEqual(captured);
  jest.advanceTimersByTime(11 * 24 * 60 * 60 * 1000);
  expect(referral.readWebReferralCode()).toBeUndefined();
  expect(onChange).not.toHaveBeenCalled();
});

it('does not clear a newer code when an older bind completes', () => {
  const { storage } = createStorage();
  useStorage(storage);
  const referral = loadModule();
  referral.captureWebReferralCode('OLD');
  const old = referral.readWebReferralCode();
  if (!old) throw new OneKeyLocalError('Missing old code');
  referral.captureWebReferralCode('NEW');
  expect(referral.clearWebReferralCodeIfMatch(old)).toBe(false);
  expect(referral.readWebReferralCode()?.code).toBe('NEW');
});

it('keeps each tab in its own session storage', () => {
  const first = createStorage();
  const second = createStorage();
  useStorage(first.storage);
  const firstTab = loadModule();
  firstTab.captureWebReferralCode('FIRST');
  useStorage(second.storage);
  const secondTab = loadModule();
  expect(secondTab.readWebReferralCode()).toBeUndefined();
  secondTab.captureWebReferralCode('SECOND');
  useStorage(first.storage);
  expect(firstTab.readWebReferralCode()?.code).toBe('FIRST');
});

it('uses memory as the authority when storage writes or removals fail', () => {
  const { storage } = createStorage();
  useStorage(storage);
  const referral = loadModule();
  referral.captureWebReferralCode('OLD');
  storage.setItem.mockImplementation(() => {
    throw new OneKeyLocalError('blocked');
  });
  referral.captureWebReferralCode('NEW');
  expect(referral.readWebReferralCode()?.code).toBe('NEW');
  const current = referral.readWebReferralCode();
  if (!current) throw new OneKeyLocalError('Missing new code');
  expect(referral.clearWebReferralCodeIfMatch(current)).toBe(true);
  expect(referral.readWebReferralCode()).toBeUndefined();
});

it('rejects malformed and incomplete stored records', () => {
  const { storage, values } = createStorage();
  useStorage(storage);
  const referral = loadModule();
  values.set('onekey_web_referral_code_v1', '{bad json');
  expect(referral.readWebReferralCode()).toBeUndefined();
  expect(storage.removeItem).toHaveBeenCalledWith(
    'onekey_web_referral_code_v1',
  );
  referral.captureWebReferralCode('RECOVERED');
  expect(storage.setItem).toHaveBeenCalled();
  expect(loadModule().readWebReferralCode()?.code).toBe('RECOVERED');

  const nextStorage = createStorage();
  useStorage(nextStorage.storage);
  const nextTab = loadModule();
  nextStorage.values.set(
    'onekey_web_referral_code_v1',
    JSON.stringify({ capturedAt: Date.now() }),
  );
  expect(nextTab.readWebReferralCode()).toBeUndefined();
});

it('does not resurrect a code if only storage removal fails', () => {
  const { storage } = createStorage();
  useStorage(storage);
  const referral = loadModule();
  referral.captureWebReferralCode('REMOVE');
  const record = referral.readWebReferralCode();
  if (!record) throw new OneKeyLocalError('Missing code to remove');
  storage.removeItem.mockImplementation(() => {
    throw new OneKeyLocalError('blocked removal');
  });
  expect(referral.clearWebReferralCodeIfMatch(record)).toBe(true);
  expect(storage.removeItem).toHaveBeenCalled();
  expect(referral.readWebReferralCode()).toBeUndefined();
});

it('normalizes an ordinary Web path while preserving other query and hash', () => {
  const { storage } = createStorage();
  useStorage(storage);
  const referral = loadModule();
  expect(
    referral.normalizeWebReferralPath('/?ref_code=ABC123&utm_source=site#top'),
  ).toBe('/?utm_source=site#top');
  expect(referral.readWebReferralCode()?.code).toBe('ABC123');
  expect(referral.normalizeWebReferralPath('/market?ref_code=ABC123')).toBe(
    '/market',
  );
  expect(referral.readWebReferralCode()?.code).toBe('ABC123');
});

it('preserves legacy referral routes and paths without a Web referral code', () => {
  const { storage } = createStorage();
  useStorage(storage);
  const referral = loadModule();
  expect(
    referral.normalizeWebReferralPath('/r/OLD/app?ref_code=NEW#landing'),
  ).toBe('/r/OLD/app?ref_code=NEW#landing');
  expect(referral.normalizeWebReferralPath('/market?utm_source=site#top')).toBe(
    '/market?utm_source=site#top',
  );
  expect(referral.readWebReferralCode()).toBeUndefined();
});

it('keeps native referral methods inert without touching session storage', () => {
  const storageGetter = jest.fn(() => {
    throw new OneKeyLocalError('Native must not access sessionStorage');
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get: storageGetter,
  });
  const native = require('./webReferralCode.native') as typeof WebReferralCode;
  const record = { code: 'ABC123', capturedAt: Date.now() };
  const listener = jest.fn();
  const unsubscribe = native.subscribeWebReferralCode(listener);
  native.captureWebReferralCode('ABC123');
  expect(native.readWebReferralCode()).toBeUndefined();
  expect(native.clearWebReferralCodeIfMatch(record)).toBe(false);
  expect(native.normalizeWebReferralPath('/?ref_code=ABC123')).toBe(
    '/?ref_code=ABC123',
  );
  unsubscribe();
  expect(listener).not.toHaveBeenCalled();
  expect(storageGetter).not.toHaveBeenCalled();
});

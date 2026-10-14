import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { getOneKeyIdAuthFailureLogLimiterStorage as getWebStorage } from './oneKeyIdAuthFailureLogLimiterStorage.web';

/*
yarn jest packages/shared/src/logger/scopes/prime/oneKeyIdAuthFailureLogLimiterStorage.test.ts
*/

describe('getOneKeyIdAuthFailureLogLimiterStorage', () => {
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    'localStorage',
  );

  afterEach(() => {
    if (descriptor) {
      Object.defineProperty(globalThis, 'localStorage', descriptor);
    } else {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('uses web storage when the runtime has it', () => {
    const storage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage,
    });

    expect(getWebStorage()).toBe(storage);
  });

  it('falls back to memory when web storage is missing or blocked', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: undefined,
    });
    expect(getWebStorage()).toBeUndefined();

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get() {
        throw new OneKeyLocalError('SecurityError');
      },
    });
    expect(getWebStorage()).toBeUndefined();
  });
});

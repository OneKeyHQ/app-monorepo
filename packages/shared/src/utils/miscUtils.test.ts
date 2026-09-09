import { generateUUID } from './miscUtils';

describe('generateUUID', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('prefers crypto.randomUUID', () => {
    const expectedUUID = '12345678-1234-4234-8234-123456789abc';
    const randomUUID = jest.fn(() => expectedUUID);
    const getRandomValues = jest.fn();
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues,
        randomUUID,
      },
    });
    const mathRandomSpy = jest.spyOn(Math, 'random');

    expect(generateUUID()).toBe(expectedUUID);
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(getRandomValues).not.toHaveBeenCalled();
    expect(mathRandomSpy).not.toHaveBeenCalled();
  });

  it('falls back to crypto.getRandomValues', () => {
    const getRandomValues = jest.fn((array: Uint8Array) => {
      array.set(Array.from({ length: 16 }, (_, index) => index));
      return array;
    });
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: { getRandomValues },
    });
    const mathRandomSpy = jest.spyOn(Math, 'random');

    expect(generateUUID()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(mathRandomSpy).not.toHaveBeenCalled();
  });

  it('uses getRandomValues when a randomUUID shim re-enters generateUUID', () => {
    const getRandomValues = jest.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: 16 }, (_, index) => index));
      return bytes;
    });
    const randomUUID = jest.fn(() => generateUUID());
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        getRandomValues,
        randomUUID,
      },
    });
    const mathRandomSpy = jest.spyOn(Math, 'random');

    expect(generateUUID()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(randomUUID).toHaveBeenCalledTimes(1);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(mathRandomSpy).not.toHaveBeenCalled();
  });

  it('falls back to Math.random when crypto APIs are unavailable', () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {},
    });
    const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);

    expect(generateUUID()).toBe('00000000-0000-4000-8000-000000000000');
    expect(mathRandomSpy).toHaveBeenCalledTimes(16);
  });
});

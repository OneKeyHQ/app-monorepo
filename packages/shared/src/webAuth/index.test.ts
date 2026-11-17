/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

// isContextSupportWebAuth is evaluated at module load from platformEnv and
// navigator.credentials, so both have to be in place before the import.
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtension: true, isE2E: false },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  __esModule: true,
  defaultLogger: { app: { webAuth: { log: jest.fn() } } },
}));

describe('isSupportWebAuth probe caching', () => {
  let isUvPaaAvailable: jest.Mock;
  let isConditionalMediationAvailable: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    isUvPaaAvailable = jest.fn().mockResolvedValue(true);
    isConditionalMediationAvailable = jest.fn().mockResolvedValue(true);
    (globalThis as any).PublicKeyCredential = {
      isUserVerifyingPlatformAuthenticatorAvailable: isUvPaaAvailable,
      isConditionalMediationAvailable,
    };
    Object.defineProperty(globalThis.navigator, 'credentials', {
      value: {},
      configurable: true,
    });
  });

  it('probes the platform once and reuses the resolved answer', async () => {
    const { isSupportWebAuth } = await import('./index');

    await expect(isSupportWebAuth()).resolves.toBe(true);
    await expect(isSupportWebAuth()).resolves.toBe(true);

    expect(isUvPaaAvailable).toHaveBeenCalledTimes(1);
    expect(isConditionalMediationAvailable).toHaveBeenCalledTimes(1);
  });

  // Caching the rejection would make one bad probe permanent for the rest of
  // the runtime and take WebAuthn registration and verification down with it.
  it('does not cache a rejected probe', async () => {
    isUvPaaAvailable.mockRejectedValueOnce(new Error('probe unavailable'));
    const { isSupportWebAuth } = await import('./index');

    await expect(isSupportWebAuth()).rejects.toThrow('probe unavailable');
    await expect(isSupportWebAuth()).resolves.toBe(true);

    expect(isUvPaaAvailable).toHaveBeenCalledTimes(2);
  });
});

import { EAtomNames } from '../states/jotai/atomNames';

import {
  isBackgroundApiAtomWritable,
  isProviderApiPrivateOriginDenied,
} from './backgroundApiPermissions';

describe('backgroundApiPermissions', () => {
  it('blocks UI writes to the background-owned Unifold recipient', () => {
    expect(
      isBackgroundApiAtomWritable(EAtomNames.perpsUnifoldActiveRecipientAtom),
    ).toBe(false);
  });

  it('blocks UI writes to the inscription protection control', () => {
    expect(
      isBackgroundApiAtomWritable(
        EAtomNames.inscriptionProtectionControlPersistAtom,
      ),
    ).toBe(false);
  });

  it('keeps regular cross-runtime atoms writable', () => {
    expect(isBackgroundApiAtomWritable(EAtomNames.settingsPersistAtom)).toBe(
      true,
    );
  });
});

describe('isProviderApiPrivateOriginDenied', () => {
  it.each([
    ['wallet_openPrimeSubscription', 'https://app.onekey.so', false],
    ['wallet_openPrimeSubscription', 'https://app.onekeytest.com', false],
    ['wallet_openPrimeSubscription', 'https://1key.so', false],
    ['wallet_openPrimeSubscription', 'https://evil.example', true],
    ['wallet_openPrimeSubscription', 'https://docs.onekey.so', true],
    ['wallet_primeWebCheckoutReturn', 'https://app.onekey.so', false],
    ['wallet_primeWebCheckoutReturn', 'https://app.onekeytest.com', false],
    ['wallet_primeWebCheckoutReturn', 'https://pay.rev.cat', true],
    ['wallet_primeWebCheckoutReturn', 'https://docs.onekey.so', true],
    ['wallet_keylessGetStatus', 'https://app.onekey.so', false],
    ['wallet_keylessGetStatus', 'https://evil.example', true],
    ['wallet_getConnectWalletInfo', 'https://evil.example', false],
  ])('method=%s origin=%s denied=%s', (method, origin, denied) => {
    expect(isProviderApiPrivateOriginDenied({ method, origin })).toBe(denied);
  });
});

describe('isWebEmbedApiAllowedOrigin', () => {
  it.each([true, false])(
    'allows the Android Metro origin only in development (isDev=%s)',
    async (isDev) => {
      jest.resetModules();
      jest.doMock('@onekeyhq/shared/src/platformEnv', () => ({
        __esModule: true,
        default: { isDev },
      }));
      try {
        const { isWebEmbedApiAllowedOrigin } =
          await import('./backgroundApiPermissions');
        expect(isWebEmbedApiAllowedOrigin('http://127.0.0.1:8081')).toBe(isDev);
        expect(
          isWebEmbedApiAllowedOrigin('http://127.0.0.1:8081.evil.example'),
        ).toBe(false);
        expect(isWebEmbedApiAllowedOrigin('https://evil.example')).toBe(false);
      } finally {
        jest.dontMock('@onekeyhq/shared/src/platformEnv');
        jest.resetModules();
      }
    },
  );
});

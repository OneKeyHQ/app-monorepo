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
  it('allows wallet_openPrimeSubscription from first-party web landings', () => {
    expect(
      isProviderApiPrivateOriginDenied({
        method: 'wallet_openPrimeSubscription',
        origin: 'https://app.onekey.so',
      }),
    ).toBe(false);
    expect(
      isProviderApiPrivateOriginDenied({
        method: 'wallet_openPrimeSubscription',
        origin: 'https://app.onekeytest.com',
      }),
    ).toBe(false);
    expect(
      isProviderApiPrivateOriginDenied({
        method: 'wallet_openPrimeSubscription',
        origin: 'https://1key.so',
      }),
    ).toBe(false);
  });

  it('denies wallet_openPrimeSubscription from other origins', () => {
    expect(
      isProviderApiPrivateOriginDenied({
        method: 'wallet_openPrimeSubscription',
        origin: 'https://evil.example',
      }),
    ).toBe(true);
    expect(
      isProviderApiPrivateOriginDenied({
        method: 'wallet_openPrimeSubscription',
        origin: 'https://docs.onekey.so',
      }),
    ).toBe(true);
  });

  it('keeps keyless methods on the first-party origin gate', () => {
    expect(
      isProviderApiPrivateOriginDenied({
        method: 'wallet_keylessGetStatus',
        origin: 'https://app.onekey.so',
      }),
    ).toBe(false);
    expect(
      isProviderApiPrivateOriginDenied({
        method: 'wallet_keylessGetStatus',
        origin: 'https://evil.example',
      }),
    ).toBe(true);
  });

  it('still allows allow-listed methods from any origin', () => {
    expect(
      isProviderApiPrivateOriginDenied({
        method: 'wallet_getConnectWalletInfo',
        origin: 'https://evil.example',
      }),
    ).toBe(false);
  });
});

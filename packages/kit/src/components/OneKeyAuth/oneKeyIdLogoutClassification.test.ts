import { EPrimeAuthSessionSource } from '@onekeyhq/shared/types/prime/primeTypes';

import { classifyOneKeyIdLogoutKeylessHandling } from './oneKeyIdLogoutClassification';

describe('classifyOneKeyIdLogoutKeylessHandling', () => {
  const base = {
    isOneKeyIdSource: true,
    hasKeylessWallet: true,
    keylessWalletReadFailed: false,
    isOneKeyIdLoggedIn: true,
  } as const;

  test('KeylessOAuth-backed login: linked (destructive) logout, no preserve', () => {
    expect(
      classifyOneKeyIdLogoutKeylessHandling({
        ...base,
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      }),
    ).toEqual({
      shouldSkipLinkedLogout: false,
      preserveLocalKeylessAuthOnOneKeyIdLogout: false,
    });
  });

  test('legacy-email login with a local keyless wallet: preserve the keyless auth', () => {
    expect(
      classifyOneKeyIdLogoutKeylessHandling({
        ...base,
        authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
      }),
    ).toEqual({
      shouldSkipLinkedLogout: true,
      preserveLocalKeylessAuthOnOneKeyIdLogout: true,
    });
  });

  test('transient wallet-read failure degrades to the wallet-preserving branch (never destructive)', () => {
    // The regression this fix guards: a momentary getKeylessWallet() failure
    // leaves hasKeylessWallet=false (wallet unreadable) and authSessionSource
    // undefined, yet the OneKey ID logout must still preserve the local
    // keyless session + legacy OAuth blobs rather than delete them.
    expect(
      classifyOneKeyIdLogoutKeylessHandling({
        isOneKeyIdSource: true,
        hasKeylessWallet: false,
        keylessWalletReadFailed: true,
        isOneKeyIdLoggedIn: true,
        authSessionSource: undefined,
      }),
    ).toEqual({
      shouldSkipLinkedLogout: false,
      preserveLocalKeylessAuthOnOneKeyIdLogout: true,
    });
  });

  test('genuine no-wallet (read succeeded, resolved undefined): no preserve, nothing to tear down', () => {
    // Distinct from the transient-failure case above: a resolved "no wallet"
    // has nothing to preserve, so the destructive teardown is a no-op and
    // preserve stays false.
    expect(
      classifyOneKeyIdLogoutKeylessHandling({
        isOneKeyIdSource: true,
        hasKeylessWallet: false,
        keylessWalletReadFailed: false,
        isOneKeyIdLoggedIn: true,
        authSessionSource: undefined,
      }),
    ).toEqual({
      shouldSkipLinkedLogout: false,
      preserveLocalKeylessAuthOnOneKeyIdLogout: false,
    });
  });

  test('not-logged-in OneKey ID logout with a keyless wallet: preserve (never remove the wallet)', () => {
    expect(
      classifyOneKeyIdLogoutKeylessHandling({
        isOneKeyIdSource: true,
        hasKeylessWallet: true,
        keylessWalletReadFailed: false,
        isOneKeyIdLoggedIn: false,
        authSessionSource: EPrimeAuthSessionSource.KeylessOAuth,
      }),
    ).toEqual({
      shouldSkipLinkedLogout: true,
      preserveLocalKeylessAuthOnOneKeyIdLogout: true,
    });
  });

  test('keyless-wallet source (not a OneKey ID logout): never sets the OneKey-ID-only preserve flag', () => {
    // preserveLocalKeylessAuthOnOneKeyIdLogout only applies to a OneKey ID
    // logout; a wallet-initiated logout leaves it false even when the linked
    // logout is skipped.
    expect(
      classifyOneKeyIdLogoutKeylessHandling({
        isOneKeyIdSource: false,
        hasKeylessWallet: true,
        keylessWalletReadFailed: false,
        isOneKeyIdLoggedIn: true,
        authSessionSource: EPrimeAuthSessionSource.LegacyEmailSupabase,
      }),
    ).toEqual({
      shouldSkipLinkedLogout: true,
      preserveLocalKeylessAuthOnOneKeyIdLogout: false,
    });
  });
});

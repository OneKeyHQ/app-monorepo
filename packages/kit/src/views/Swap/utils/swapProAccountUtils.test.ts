import {
  ESwapProAccountStatus,
  ESwapProErrorAlertAction,
  buildSwapProAccountScope,
  getSwapProAccountForCurrentScope,
  getSwapProErrorAlertAction,
  resolveSwapProAccountIdentity,
  resolveSwapProAccountStatus,
  shouldSyncSwapProAccountNetwork,
} from './swapProAccountUtils';

describe('Swap Pro account state', () => {
  const accountScope = buildSwapProAccountScope({
    targetNetworkId: 'evm--56',
    indexedAccountId: undefined,
    accountId: 'watching-account',
  });

  it('builds the scope from the target network and selected account identity', () => {
    expect(accountScope).toBe('evm--56||watching-account');
  });

  it('stays pending until the current account scope resolves', () => {
    expect(
      resolveSwapProAccountStatus({
        hasConnectedAccount: true,
        accountScope,
        resolvedAccountScope: 'btc--0||watching-account',
        accountAddress: undefined,
      }),
    ).toBe(ESwapProAccountStatus.PENDING);
  });

  it('distinguishes a resolved supported account from unsupported', () => {
    expect(
      resolveSwapProAccountStatus({
        hasConnectedAccount: true,
        accountScope,
        resolvedAccountScope: accountScope,
        accountAddress: '0xabc',
      }),
    ).toBe(ESwapProAccountStatus.SUPPORTED);
    expect(
      resolveSwapProAccountStatus({
        hasConnectedAccount: true,
        accountScope,
        resolvedAccountScope: accountScope,
        accountAddress: undefined,
      }),
    ).toBe(ESwapProAccountStatus.UNSUPPORTED);
  });

  it('does not classify a disconnected wallet as unsupported', () => {
    expect(
      resolveSwapProAccountStatus({
        hasConnectedAccount: false,
        accountScope: '',
        resolvedAccountScope: '',
        accountAddress: undefined,
      }),
    ).toBe(ESwapProAccountStatus.NO_ACCOUNT);
  });

  it('uses selected identity atomically after AccountSelector initialization', () => {
    expect(
      resolveSwapProAccountIdentity({
        isAccountSelectorStorageInitDone: true,
        selectedIndexedAccountId: undefined,
        selectedAccountId: 'singleton-b',
        activeIndexedAccountId: 'indexed-a',
        activeAccountId: undefined,
      }),
    ).toEqual({
      indexedAccountId: undefined,
      accountId: 'singleton-b',
    });
    expect(
      resolveSwapProAccountIdentity({
        isAccountSelectorStorageInitDone: true,
        selectedIndexedAccountId: undefined,
        selectedAccountId: undefined,
        activeIndexedAccountId: 'indexed-a',
        activeAccountId: undefined,
      }),
    ).toEqual({
      indexedAccountId: undefined,
      accountId: undefined,
    });
  });

  it('falls back to active identity only before selected storage initializes', () => {
    expect(
      resolveSwapProAccountIdentity({
        isAccountSelectorStorageInitDone: false,
        selectedIndexedAccountId: undefined,
        selectedAccountId: undefined,
        activeIndexedAccountId: 'indexed-a',
        activeAccountId: undefined,
      }),
    ).toEqual({
      indexedAccountId: 'indexed-a',
      accountId: undefined,
    });
  });

  it('uses an available selected identity before storage initialization completes', () => {
    expect(
      resolveSwapProAccountIdentity({
        isAccountSelectorStorageInitDone: false,
        selectedIndexedAccountId: undefined,
        selectedAccountId: 'singleton-b',
        activeIndexedAccountId: 'indexed-a',
        activeAccountId: undefined,
      }),
    ).toEqual({
      indexedAccountId: undefined,
      accountId: 'singleton-b',
    });
  });

  it('exposes stale account data only inside the same logical scope', () => {
    expect(
      getSwapProAccountForCurrentScope({
        accountScope,
        resolvedAccountScope: accountScope,
        account: 'account-a',
      }),
    ).toBe('account-a');
    expect(
      getSwapProAccountForCurrentScope({
        accountScope: 'evm--1|indexed-b|',
        resolvedAccountScope: accountScope,
        account: 'account-a',
      }),
    ).toBeUndefined();
    expect(
      getSwapProAccountForCurrentScope({
        accountScope: '',
        resolvedAccountScope: accountScope,
        account: 'account-a',
      }),
    ).toBeUndefined();
  });
});

describe('getSwapProErrorAlertAction', () => {
  const accountScope = 'evm--56||watching-account';

  it('keeps the settled alert during same-scope account revalidation', () => {
    expect(
      getSwapProErrorAlertAction({
        isSwapProActive: true,
        previousAccountScope: accountScope,
        accountScope,
        accountStatus: ESwapProAccountStatus.PENDING,
        hasQuoteError: false,
      }),
    ).toBe(ESwapProErrorAlertAction.PRESERVE);
  });

  it('clears an old alert while a different account scope is pending', () => {
    expect(
      getSwapProErrorAlertAction({
        isSwapProActive: true,
        previousAccountScope: 'btc--0||watching-account',
        accountScope,
        accountStatus: ESwapProAccountStatus.PENDING,
        hasQuoteError: false,
      }),
    ).toBe(ESwapProErrorAlertAction.CLEAR);
  });

  it('shows unsupported only after the current scope settles', () => {
    expect(
      getSwapProErrorAlertAction({
        isSwapProActive: true,
        previousAccountScope: accountScope,
        accountScope,
        accountStatus: ESwapProAccountStatus.UNSUPPORTED,
        hasQuoteError: false,
      }),
    ).toBe(ESwapProErrorAlertAction.UNSUPPORTED);
  });

  it('keeps quote errors behind a supported account and clears outside Pro', () => {
    expect(
      getSwapProErrorAlertAction({
        isSwapProActive: true,
        previousAccountScope: accountScope,
        accountScope,
        accountStatus: ESwapProAccountStatus.SUPPORTED,
        hasQuoteError: true,
      }),
    ).toBe(ESwapProErrorAlertAction.QUOTE_ERROR);
    expect(
      getSwapProErrorAlertAction({
        isSwapProActive: false,
        previousAccountScope: accountScope,
        accountScope,
        accountStatus: ESwapProAccountStatus.UNSUPPORTED,
        hasQuoteError: false,
      }),
    ).toBe(ESwapProErrorAlertAction.CLEAR);
  });
});

describe('shouldSyncSwapProAccountNetwork', () => {
  const baseParams = {
    isSwapProActive: true,
    targetNetworkId: 'evm--56',
    currentNetworkId: 'btc--0',
    hasConnectedAccount: true,
    hasIndexedAccount: false,
    isSingletonAccountReady: true,
    isSingletonAccountCompatible: true,
  };

  it('allows multi-network and compatible singleton accounts to follow the Pro token network', () => {
    expect(
      shouldSyncSwapProAccountNetwork({
        ...baseParams,
        hasIndexedAccount: true,
        isSingletonAccountCompatible: false,
      }),
    ).toBe(true);
    expect(shouldSyncSwapProAccountNetwork(baseParams)).toBe(true);
  });

  it('does not force an incompatible singleton account onto the Pro token network', () => {
    expect(
      shouldSyncSwapProAccountNetwork({
        ...baseParams,
        isSingletonAccountCompatible: false,
      }),
    ).toBe(false);
  });

  it('waits for singleton account metadata before deciding compatibility', () => {
    expect(
      shouldSyncSwapProAccountNetwork({
        ...baseParams,
        isSingletonAccountReady: false,
      }),
    ).toBe(false);
  });

  it('allows the target network to initialize when no wallet is connected', () => {
    expect(
      shouldSyncSwapProAccountNetwork({
        ...baseParams,
        hasConnectedAccount: false,
        isSingletonAccountReady: false,
        isSingletonAccountCompatible: false,
      }),
    ).toBe(true);
  });
});

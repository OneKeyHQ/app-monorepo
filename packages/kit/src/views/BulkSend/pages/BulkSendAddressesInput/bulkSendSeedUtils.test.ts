import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type {
  IBulkSendAddressesInputSeed,
  IBulkSendAddressesInputSeedSender,
} from '@onekeyhq/shared/types/bulkSend';

import {
  buildBulkSendFallbackSeed,
  buildBulkSendSeedSource,
  buildSeededSenderBadgeLabel,
  computeBulkSendNextDisabled,
  isBulkSendSeedEqual,
  resolveBulkSendSeedApplyPlan,
} from './bulkSendSeedUtils';

const ETH_ACCOUNT_ID = "hd-1--m/44'/60'/0'/0/0";

function createSeed(
  overrides: Partial<IBulkSendAddressesInputSeed> = {},
): IBulkSendAddressesInputSeed {
  return {
    accountId: ETH_ACCOUNT_ID,
    indexedAccountId: 'hd-1--0',
    networkId: 'evm--1',
    isSupportedNetwork: true,
    token: {
      address: '',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      isNative: true,
      logoURI: 'https://img.test/eth.png',
      networkId: 'evm--1',
      networkName: 'Ethereum',
    },
    network: { id: 'evm--1', name: 'Ethereum', logoURI: 'https://x/e.png' },
    sender: {
      address: '0xabc',
      accountName: 'Account #1',
      walletName: 'Wallet 1',
    },
    ...overrides,
  };
}

describe('buildBulkSendSeedSource', () => {
  it('prefers route params and falls back to the home account per field', () => {
    expect(
      buildBulkSendSeedSource({
        routeParams: { networkId: 'evm--56', indexedAccountId: undefined },
        homeSeedAccount: {
          networkId: 'evm--1',
          accountId: ETH_ACCOUNT_ID,
          indexedAccountId: 'hd-1--0',
        },
        bulkSendMode: EBulkSendMode.OneToMany,
      }),
    ).toEqual({
      networkId: 'evm--56',
      accountId: ETH_ACCOUNT_ID,
      indexedAccountId: 'hd-1--0',
      tokenInfo: undefined,
      bulkSendMode: EBulkSendMode.OneToMany,
    });
  });
});

describe('isBulkSendSeedEqual', () => {
  it('treats seeds with the same identity, token, network and sender as equal', () => {
    // A revalidated seed is a fresh object; identity must not matter.
    expect(isBulkSendSeedEqual(createSeed(), createSeed())).toBe(true);
  });

  it('detects a changed account, token, network or sender', () => {
    expect(
      isBulkSendSeedEqual(createSeed(), createSeed({ accountId: 'hd-2--x' })),
    ).toBe(false);
    expect(
      isBulkSendSeedEqual(
        createSeed(),
        createSeed({
          token: { ...createSeed().token!, address: '0xusdt', symbol: 'USDT' },
        }),
      ),
    ).toBe(false);
    expect(
      isBulkSendSeedEqual(
        createSeed(),
        createSeed({ sender: { address: '0xother' } }),
      ),
    ).toBe(false);
    expect(isBulkSendSeedEqual(undefined, createSeed())).toBe(false);
  });
});

describe('buildSeededSenderBadgeLabel', () => {
  it('matches the validator badge format "wallet / account"', () => {
    expect(buildSeededSenderBadgeLabel(createSeed().sender)).toBe(
      'Wallet 1 / Account #1',
    );
  });

  it('returns nothing when either name is missing', () => {
    expect(
      buildSeededSenderBadgeLabel({ address: '0xabc', walletName: 'W' }),
    ).toBeUndefined();
    expect(buildSeededSenderBadgeLabel(undefined)).toBeUndefined();
  });
});

describe('computeBulkSendNextDisabled', () => {
  const ready = {
    isFormValid: true,
    isFormValidating: false,
    isInitializing: false,
    isSenderFieldMounted: true,
    isOneToMany: true,
    tokenDetailsState: { initialized: true, isRefreshing: false },
    hasTokenDetail: true,
  };

  it('is enabled only when the form is valid and every gate is open', () => {
    expect(computeBulkSendNextDisabled(ready)).toBe(false);
  });

  it('stays disabled while the seed is loading even if the form reports valid', () => {
    // react-hook-form reports isValid=true when no field has registered
    // yet (cold start: the account selector store is still hydrating), so
    // the initialization gates must not rely on form validity alone.
    expect(
      computeBulkSendNextDisabled({ ...ready, isInitializing: true }),
    ).toBe(true);
    expect(
      computeBulkSendNextDisabled({ ...ready, isSenderFieldMounted: false }),
    ).toBe(true);
  });

  it('keeps the OneToMany balance gate', () => {
    expect(
      computeBulkSendNextDisabled({
        ...ready,
        tokenDetailsState: { initialized: false, isRefreshing: true },
      }),
    ).toBe(true);
    expect(
      computeBulkSendNextDisabled({
        ...ready,
        tokenDetailsState: { initialized: true, isRefreshing: true },
        hasTokenDetail: false,
      }),
    ).toBe(true);
    expect(
      computeBulkSendNextDisabled({
        ...ready,
        isOneToMany: false,
        tokenDetailsState: { initialized: false, isRefreshing: true },
        hasTokenDetail: false,
      }),
    ).toBe(false);
  });

  it('follows form validity and validating state', () => {
    expect(computeBulkSendNextDisabled({ ...ready, isFormValid: false })).toBe(
      true,
    );
    expect(
      computeBulkSendNextDisabled({ ...ready, isFormValidating: true }),
    ).toBe(true);
  });
});

describe('buildBulkSendFallbackSeed', () => {
  it('echoes the request on a supported network so the page can mount', () => {
    expect(
      buildBulkSendFallbackSeed({
        networkId: 'evm--1',
        accountId: 'hd-1--m/44h/60h/0h/0/0',
        indexedAccountId: 'hd-1--0',
        bulkSendMode: EBulkSendMode.OneToMany,
      }),
    ).toEqual({
      accountId: 'hd-1--m/44h/60h/0h/0/0',
      indexedAccountId: 'hd-1--0',
      networkId: 'evm--1',
      isSupportedNetwork: true,
      token: undefined,
    });
  });

  it('drops the account once the network had to be corrected', () => {
    // The All Networks pseudo account cannot seed lookups on the corrected
    // network; mirror ServiceBulkSend and let the user pick the sender.
    expect(
      buildBulkSendFallbackSeed({
        networkId: 'onekeyall--0',
        accountId: 'hd-1--all',
        indexedAccountId: 'hd-1--0',
        bulkSendMode: EBulkSendMode.OneToMany,
      }),
    ).toEqual({
      accountId: undefined,
      indexedAccountId: 'hd-1--0',
      networkId: 'evm--1',
      isSupportedNetwork: false,
      token: undefined,
    });
  });
});

describe('resolveBulkSendSeedApplyPlan', () => {
  const homeSender: IBulkSendAddressesInputSeedSender = {
    address: '0xhome',
    accountName: 'Account #1',
    walletName: 'Wallet 1',
  };
  const homeSeed: IBulkSendAddressesInputSeed = {
    accountId: 'hd-1--m/44h/60h/0h/0/0',
    indexedAccountId: 'hd-1--0',
    networkId: 'evm--1',
    isSupportedNetwork: true,
    sender: homeSender,
  };
  const userAccountId = 'hd-1--m/44h/60h/0h/0/1';
  const key = 'bulkSendSeed:v1:home';

  function plan(
    overrides: Partial<Parameters<typeof resolveBulkSendSeedApplyPlan>[0]>,
  ) {
    return resolveBulkSendSeedApplyPlan({
      seed: homeSeed,
      seedKey: key,
      appliedSeed: { key, seed: homeSeed },
      selectedAccountId: homeSeed.accountId,
      selectedNetworkId: homeSeed.networkId,
      hasUserSelectedAsset: false,
      isDegradedSeed: false,
      ...overrides,
    });
  }

  it('applies the first seed and skips an identical revalidation', () => {
    expect(
      plan({
        appliedSeed: undefined,
        selectedAccountId: undefined,
        selectedNetworkId: undefined,
      }),
    ).toEqual({ action: 'apply', keepUserToken: false });
    expect(plan({})).toEqual({ action: 'skip' });
    expect(plan({ seed: undefined })).toEqual({ action: 'skip' });
  });

  it('re-applies a revalidated seed while the user kept the seeded selection', () => {
    const refreshed = {
      ...homeSeed,
      sender: { ...homeSender, walletName: 'Renamed wallet' },
    };
    expect(plan({ seed: refreshed })).toEqual({
      action: 'apply',
      keepUserToken: false,
    });
  });

  it('records a seed for another account once the user changed the sender', () => {
    // A revalidated snapshot whose metadata changed used to restore the
    // entry sender / asset over the user's pick; so did the re-keyed
    // request after a mode switch.
    const refreshed = {
      ...homeSeed,
      sender: { ...homeSender, walletName: 'Renamed wallet' },
    };
    expect(plan({ seed: refreshed, selectedAccountId: userAccountId })).toEqual(
      { action: 'record' },
    );
    expect(
      plan({
        seed: refreshed,
        seedKey: 'bulkSendSeed:v1:home:many',
        selectedAccountId: userAccountId,
      }),
    ).toEqual({ action: 'record' });
  });

  it('refreshes a seed for the selection the user is on and keeps a picked asset', () => {
    const userSeed = {
      ...homeSeed,
      accountId: userAccountId,
      sender: { ...homeSender, address: '0xuser' },
    };
    expect(
      plan({
        seed: userSeed,
        seedKey: 'bulkSendSeed:v1:user',
        selectedAccountId: userAccountId,
        hasUserSelectedAsset: true,
      }),
    ).toEqual({ action: 'apply', keepUserToken: true });
  });

  it('brings the seed token along when the seed moves to another network', () => {
    // The user picked an asset on evm--1 without changing the selection;
    // a seed that re-targets the page must not keep that token under the
    // new network (cross-chain token / network mismatch on the next step).
    const otherNetworkSeed = {
      ...homeSeed,
      networkId: 'evm--56',
      network: { id: 'evm--56', name: 'BNB Chain', logoURI: '' },
    };
    expect(
      plan({
        seed: otherNetworkSeed,
        seedKey: 'bulkSendSeed:v1:bsc',
        hasUserSelectedAsset: true,
      }),
    ).toEqual({ action: 'apply', keepUserToken: false });
  });

  it('records, without applying, a degraded seed over an already applied one', () => {
    // Re-entry paints the snapshot; if the fresh request then fails (or the
    // account remap loses the account) the fallback must only settle the
    // initializing gate, not blank the sender / token already on screen.
    const fallback: IBulkSendAddressesInputSeed = {
      accountId: undefined,
      indexedAccountId: 'hd-1--0',
      networkId: 'evm--1',
      isSupportedNetwork: false,
    };
    expect(plan({ seed: fallback, isDegradedSeed: true })).toEqual({
      action: 'record',
    });
    expect(plan({ seed: fallback })).toEqual({ action: 'record' });
    // Cold start without a snapshot still mounts on the fallback.
    expect(
      plan({
        seed: fallback,
        isDegradedSeed: true,
        appliedSeed: undefined,
        selectedAccountId: undefined,
      }),
    ).toEqual({ action: 'apply', keepUserToken: false });
  });
});

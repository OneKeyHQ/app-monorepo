import { EBulkSendMode } from '@onekeyhq/shared/types/bulkSend';
import type { IBulkSendAddressesInputSeed } from '@onekeyhq/shared/types/bulkSend';

import {
  buildBulkSendSeedSource,
  buildSeededSenderBadgeLabel,
  computeBulkSendNextDisabled,
  isBulkSendSeedEqual,
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

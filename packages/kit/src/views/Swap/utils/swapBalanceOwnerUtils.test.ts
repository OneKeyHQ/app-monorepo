import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapBalanceOwner,
  isSameSwapBalanceOwner,
  resolveVerifiedSwapBalance,
} from './swapBalanceOwnerUtils';

const ethToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
};
const uniToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xuni',
  symbol: 'UNI',
  decimals: 18,
  isNative: false,
};

describe('buildSwapBalanceOwner', () => {
  it('pairs the token identity with a lower-cased address', () => {
    expect(
      buildSwapBalanceOwner({ token: ethToken, accountAddress: '0xABC' }),
    ).toEqual({ tokenKey: 'evm--1::native', accountAddress: '0xabc' });
  });

  it('has no owner without a token or an address', () => {
    expect(
      buildSwapBalanceOwner({ token: undefined, accountAddress: '0xabc' }),
    ).toBeUndefined();
    expect(
      buildSwapBalanceOwner({ token: ethToken, accountAddress: undefined }),
    ).toBeUndefined();
  });
});

describe('isSameSwapBalanceOwner', () => {
  const stored = { tokenKey: 'evm--1::native', accountAddress: '0xabc' };

  it('matches the same token and address only', () => {
    expect(
      isSameSwapBalanceOwner(
        stored,
        buildSwapBalanceOwner({ token: ethToken, accountAddress: '0xAbC' }),
      ),
    ).toBe(true);
    expect(
      isSameSwapBalanceOwner(
        stored,
        buildSwapBalanceOwner({ token: uniToken, accountAddress: '0xabc' }),
      ),
    ).toBe(false);
    expect(
      isSameSwapBalanceOwner(
        stored,
        buildSwapBalanceOwner({ token: ethToken, accountAddress: '0xdef' }),
      ),
    ).toBe(false);
  });

  it('never matches an unknown owner', () => {
    expect(isSameSwapBalanceOwner(stored, undefined)).toBe(false);
    expect(isSameSwapBalanceOwner({}, undefined)).toBe(false);
  });
});

describe('resolveVerifiedSwapBalance', () => {
  const ethOwner = {
    tokenKey: 'evm--1::native',
    accountAddress: '0xabc',
    unverified: false,
  };
  const current = {
    balance: '0',
    balanceMeta: ethOwner,
    token: ethToken,
    accountAddress: '0xABC',
    isAddressInfoReady: true,
  };

  it('returns the balance for the token and account it was fetched for', () => {
    expect(resolveVerifiedSwapBalance(current)).toBe('0');
  });

  it('drops a fallback figure', () => {
    expect(
      resolveVerifiedSwapBalance({
        ...current,
        balanceMeta: { ...ethOwner, unverified: true },
      }),
    ).toBeUndefined();
  });

  it('drops the previous token balance after a new token is selected', () => {
    expect(
      resolveVerifiedSwapBalance({ ...current, token: uniToken }),
    ).toBeUndefined();
    expect(
      resolveVerifiedSwapBalance({ ...current, token: undefined }),
    ).toBeUndefined();
  });

  it('drops a balance that belongs to another account once the address is known', () => {
    expect(
      resolveVerifiedSwapBalance({ ...current, accountAddress: '0xdef' }),
    ).toBeUndefined();
    expect(
      resolveVerifiedSwapBalance({ ...current, accountAddress: undefined }),
    ).toBeUndefined();
  });

  it('keeps the same-token balance while the account lookup is pending', () => {
    expect(
      resolveVerifiedSwapBalance({
        ...current,
        accountAddress: undefined,
        isAddressInfoReady: false,
      }),
    ).toBe('0');
    expect(
      resolveVerifiedSwapBalance({
        ...current,
        token: uniToken,
        accountAddress: undefined,
        isAddressInfoReady: false,
      }),
    ).toBeUndefined();
  });

  it('treats a balance without an owner as not loaded', () => {
    expect(
      resolveVerifiedSwapBalance({
        ...current,
        balanceMeta: { unverified: false },
      }),
    ).toBeUndefined();
  });
});

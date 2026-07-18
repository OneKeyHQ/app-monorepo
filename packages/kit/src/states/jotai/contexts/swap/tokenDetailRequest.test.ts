import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapTokenDetailRequestKey,
  isCurrentSwapTokenDetailRequest,
  isSwapTokenDetailAddressInfoReady,
  isSwapTokenDetailBalanceVisible,
  startSwapTokenDetailRequest,
} from './tokenDetailRequest';

describe('swap token detail request ownership', () => {
  const token = {
    networkId: 'evm--1',
    contractAddress: '0xToken',
    symbol: 'TKN',
    decimals: 18,
  };

  it('changes the key when account or resolved address changes', () => {
    const first = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token,
      accountId: 'account-a',
      accountAddress: '0xA',
      resolvedNetworkId: 'evm--1',
    });
    const second = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token,
      accountId: 'account-b',
      accountAddress: '0xB',
      resolvedNetworkId: 'evm--1',
    });

    expect(second).not.toBe(first);
  });

  it('changes the key when the same owner becomes address-ready', () => {
    const pending = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token,
      accountId: 'account-a',
      accountAddress: '0xA',
      addressInfoReady: false,
      resolvedNetworkId: 'evm--1',
    });
    const ready = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token,
      accountId: 'account-a',
      accountAddress: '0xA',
      addressInfoReady: true,
      resolvedNetworkId: 'evm--1',
    });

    expect(ready).not.toBe(pending);
  });

  it('requires the corresponding address owners before loading token details', () => {
    expect(
      isSwapTokenDetailAddressInfoReady({
        direction: ESwapDirectionType.FROM,
        addressInfoReady: false,
      }),
    ).toBe(false);
    expect(
      isSwapTokenDetailAddressInfoReady({
        direction: ESwapDirectionType.FROM,
        addressInfoReady: true,
      }),
    ).toBe(true);
    expect(
      isSwapTokenDetailAddressInfoReady({
        direction: ESwapDirectionType.TO,
        addressInfoReady: true,
        targetAddressInfoReady: false,
      }),
    ).toBe(false);
    expect(
      isSwapTokenDetailAddressInfoReady({
        direction: ESwapDirectionType.TO,
        addressInfoReady: true,
        targetAddressInfoReady: true,
      }),
    ).toBe(true);
  });

  it('keeps the effect dependency stable across non-semantic token detail writes', () => {
    const beforeDetailWrite = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token: { ...token, balanceParsed: '1', price: '10' },
      accountId: 'account-a',
      accountAddress: '0xA',
      resolvedNetworkId: 'evm--1',
    });
    const afterDetailWrite = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token: { ...token, balanceParsed: '2', price: '11' },
      accountId: 'account-a',
      accountAddress: '0xA',
      resolvedNetworkId: 'evm--1',
    });

    expect(afterDetailWrite).toBe(beforeDetailWrite);
  });

  it('does not classify a native token and an incomplete non-native token as the same resource', () => {
    const nativeKey = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token: {
        ...token,
        contractAddress: '',
        isNative: true,
      },
      accountId: 'account-a',
      accountAddress: '0xA',
      resolvedNetworkId: 'evm--1',
    });
    const incompleteTokenKey = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token: {
        ...token,
        contractAddress: '',
        isNative: false,
      },
      accountId: 'account-a',
      accountAddress: '0xA',
      resolvedNetworkId: 'evm--1',
    });
    const nativeRequest = startSwapTokenDetailRequest({
      direction: ESwapDirectionType.FROM,
      key: nativeKey,
      state: {},
    });
    const incompleteRequest = startSwapTokenDetailRequest({
      direction: ESwapDirectionType.FROM,
      key: incompleteTokenKey,
      state: nativeRequest.state,
    });

    expect(incompleteTokenKey).not.toBe(nativeKey);
    expect(incompleteRequest.isSameResource).toBe(false);
    expect(
      isSwapTokenDetailBalanceVisible({
        addressInfoReady: true,
        direction: ESwapDirectionType.FROM,
        initialSelectedTokensSynced: true,
        isCurrentDisplayToken: true,
        key: nativeKey,
        state: incompleteRequest.state,
      }),
    ).toBe(false);
  });

  it('changes the TO resource key when the target derive owner changes', () => {
    const deriveA = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.TO,
      token,
      accountId: 'source-account',
      accountAddress: '0xSource',
      resolvedNetworkId: 'evm--1',
      targetAccountId: 'target-account',
      targetAccountAddress: '0xTarget',
      targetDeriveType: 'derive-a',
      targetNetworkId: 'evm--1',
    });
    const deriveB = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.TO,
      token,
      accountId: 'source-account',
      accountAddress: '0xSource',
      resolvedNetworkId: 'evm--1',
      targetAccountId: 'target-account',
      targetAccountAddress: '0xTarget',
      targetDeriveType: 'derive-b',
      targetNetworkId: 'evm--1',
    });

    expect(deriveB).not.toBe(deriveA);
  });

  it('preserves the resource classification but advances revision on refresh', () => {
    const first = startSwapTokenDetailRequest({
      direction: ESwapDirectionType.FROM,
      key: 'same-key',
      state: {},
    });
    const second = startSwapTokenDetailRequest({
      direction: ESwapDirectionType.FROM,
      key: 'same-key',
      state: first.state,
    });

    expect(second.isSameResource).toBe(true);
    expect(second.identity.revision).toBe(first.identity.revision + 1);
    expect(
      isCurrentSwapTokenDetailRequest({
        direction: ESwapDirectionType.FROM,
        identity: first.identity,
        state: second.state,
      }),
    ).toBe(false);
  });

  it('keeps from and to request ownership independent', () => {
    const from = startSwapTokenDetailRequest({
      direction: ESwapDirectionType.FROM,
      key: 'from-key',
      state: {},
    });
    const to = startSwapTokenDetailRequest({
      direction: ESwapDirectionType.TO,
      key: 'to-key',
      state: from.state,
    });

    expect(
      isCurrentSwapTokenDetailRequest({
        direction: ESwapDirectionType.FROM,
        identity: from.identity,
        state: to.state,
      }),
    ).toBe(true);
  });

  it('fails closed when cold-start sync reveals the same token for a different account owner', () => {
    const accountAKey = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token,
      accountId: 'account-a',
      accountAddress: '0xA',
      resolvedNetworkId: 'evm--1',
    });
    const accountBKey = buildSwapTokenDetailRequestKey({
      direction: ESwapDirectionType.FROM,
      token,
      accountId: 'account-b',
      accountAddress: '0xB',
      resolvedNetworkId: 'evm--1',
    });
    const bootState = startSwapTokenDetailRequest({
      direction: ESwapDirectionType.FROM,
      key: accountAKey,
      state: {},
    }).state;

    expect(
      isSwapTokenDetailBalanceVisible({
        addressInfoReady: true,
        direction: ESwapDirectionType.FROM,
        initialSelectedTokensSynced: false,
        isCurrentDisplayToken: true,
        key: accountAKey,
        state: bootState,
      }),
    ).toBe(false);
    expect(
      isSwapTokenDetailBalanceVisible({
        addressInfoReady: true,
        direction: ESwapDirectionType.FROM,
        initialSelectedTokensSynced: true,
        isCurrentDisplayToken: true,
        key: accountAKey,
        state: bootState,
      }),
    ).toBe(true);
    expect(
      isSwapTokenDetailBalanceVisible({
        addressInfoReady: false,
        direction: ESwapDirectionType.FROM,
        initialSelectedTokensSynced: true,
        isCurrentDisplayToken: true,
        key: accountAKey,
        state: bootState,
      }),
    ).toBe(false);
    // When initialSelectedTokensSynced flips for account B, the UI checks B's
    // semantic key synchronously and must not expose account A's balance atom.
    expect(
      isSwapTokenDetailBalanceVisible({
        addressInfoReady: true,
        direction: ESwapDirectionType.FROM,
        initialSelectedTokensSynced: true,
        isCurrentDisplayToken: true,
        key: accountBKey,
        state: bootState,
      }),
    ).toBe(false);
  });
});

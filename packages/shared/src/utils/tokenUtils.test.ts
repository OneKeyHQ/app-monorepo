/*
yarn test packages/shared/src/utils/tokenUtils.test.ts
*/
import { calculateAccountTotalValue } from './tokenUtils';

describe('calculateAccountTotalValue — tray case (no filters)', () => {
  test('sums all token values + deFi when no filters passed', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          'acct-1_evm--1': '100',
          'acct-1_evm--56': '50',
        },
        deFiNetWorth: 25,
      }),
    ).toBe('175');
  });

  test('handles string tokensValue + deFi', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: '100',
        deFiNetWorth: '25.5',
      }),
    ).toBe('125.5');
  });

  test('returns undefined when both inputs absent', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: undefined,
        deFiNetWorth: undefined,
      }),
    ).toBeUndefined();
  });

  test('tokens-only when deFi is 0 / undefined', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: '100',
        deFiNetWorth: 0,
      }),
    ).toBe('100');
    expect(
      calculateAccountTotalValue({
        tokensValue: '100',
        deFiNetWorth: undefined,
      }),
    ).toBe('100');
  });
});

describe('calculateAccountTotalValue — single network (accountId + networkId)', () => {
  test('picks the specific networkId entry + deFi for that network', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          'acct-1_evm--1': '100',
          'acct-1_evm--56': '50',
        },
        deFiNetWorth: 25,
        accountId: 'acct-1',
        networkId: 'evm--1',
      }),
    ).toBe('125');
  });

  test('returns undefined when both the picked token entry and deFi are absent', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: { 'other-acct_evm--1': '100' },
        deFiNetWorth: undefined,
        accountId: 'acct-1',
        networkId: 'evm--1',
      }),
    ).toBeUndefined();
  });

  test('returns deFi only when token entry absent but deFi present', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: { 'other-acct_evm--1': '100' },
        deFiNetWorth: 25,
        accountId: 'acct-1',
        networkId: 'evm--1',
      }),
    ).toBe('25');
  });
});

describe('calculateAccountTotalValue — mergeDeriveAssetsEnabled branch', () => {
  test('sums entries whose key suffix matches networkId; does NOT add deFi', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          'x_taproot_btc--0': '10',
          'x_segwit_btc--0': '20',
          'x_legacy_btc--0': '30',
          'x_default_evm--1': '1000',
        },
        deFiNetWorth: 999, // ignored by merge-derive branch
        mergeDeriveAssetsEnabled: true,
        networkId: 'btc--0',
      }),
    ).toBe('60');
  });

  test('returns undefined when no entry matches and deFi absent', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: { 'x_default_evm--1': '1000' },
        deFiNetWorth: undefined,
        mergeDeriveAssetsEnabled: true,
        networkId: 'btc--0',
      }),
    ).toBeUndefined();
  });

  test('returns undefined when no entry matches even if deFiNetWorth is explicit 0', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: { 'x_default_evm--1': '1000' },
        deFiNetWorth: 0, // explicit 0, not undefined
        mergeDeriveAssetsEnabled: true,
        networkId: 'btc--0',
      }),
    ).toBeUndefined();
  });
});

describe('calculateAccountTotalValue — wallet-scoped derive matching branch', () => {
  const enabled = [{ id: 'evm--1' }, { id: 'evm--56' }];
  const networkInfoMap = {
    'evm--1': { deriveType: 'default', mergeDeriveAssetsEnabled: false },
    'evm--56': { deriveType: 'default', mergeDeriveAssetsEnabled: false },
  };

  test('sums only entries matching walletId + compatible network + deriveType, plus deFi', () => {
    expect(
      calculateAccountTotalValue({
        tokensValue: {
          // matches: hd-1, evm--1, default
          'hd-1--path--default_evm--1': '100',
          // matches: hd-1, evm--56, default
          'hd-1--path--default_evm--56': '50',
          // wrong wallet
          'hd-2--path--default_evm--1': '9999',
          // incompatible network
          'hd-1--path--default_sol--101': '9999',
          // wrong deriveType
          'hd-1--path--ledger_evm--1': '9999',
        },
        deFiNetWorth: 25,
        walletId: 'hd-1',
        enabledNetworksCompatibleWithWalletId: enabled,
        networkInfoMap,
      }),
    ).toBe('175');
  });
});

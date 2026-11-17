/*
yarn jest packages/shared/src/utils/sharedBalanceUtils.test.ts

OK-63633: Arc (evm--5042) native USDC and the ERC-20 interface 0x3600… share
one balance. The server marks the ERC-20 row with `sharedBalanceExcluded` +
`sharedBalanceWith` ('' = the native address). Client totals must count the
balance once, never zero times, and must never drop the row from the list.
*/

import {
  applySharedBalanceExclusionToTokenGroups,
  isSharedBalanceMarkedToken,
  resolveSharedBalanceExcludedKeys,
} from './sharedBalanceUtils';
import {
  sumFiatValuesFromTokens,
  sumFiatValuesIgnoringUnavailable,
  sumTokenGroupsFiatValueIgnoringUnavailable,
} from './tokenValueUtils';

import type { IAccountToken, ITokenData, ITokenFiat } from '../../types/token';

const ARC = 'evm--5042';
const NATIVE_KEY = `${ARC}_0xacc_native`;
const ERC20_KEY = `${ARC}_0xacc_0x3600000000000000000000000000000000000000`;

function nativeUsdc(): IAccountToken {
  return {
    $key: NATIVE_KEY,
    address: '',
    decimals: 18,
    isNative: true,
    name: 'Arc',
    symbol: 'USDC',
    networkId: ARC,
  };
}

function erc20Usdc(): IAccountToken {
  return {
    $key: ERC20_KEY,
    address: '0x3600000000000000000000000000000000000000',
    decimals: 6,
    isNative: false,
    name: 'USDC',
    symbol: 'USDC',
    networkId: ARC,
    sharedBalanceExcluded: true,
    sharedBalanceWith: '',
  };
}

function fiat(fiatValue: string, price = 1): ITokenFiat {
  return { balance: '1', balanceParsed: '1', fiatValue, price };
}

function group(
  tokens: IAccountToken[],
  map: Record<string, ITokenFiat>,
  fiatValue?: string,
): ITokenData {
  return {
    data: tokens,
    keys: tokens.map((t) => t.$key).join(','),
    map,
    fiatValue,
  };
}

describe('isSharedBalanceMarkedToken', () => {
  test('requires both fields; sharedBalanceWith "" still counts as present', () => {
    expect(isSharedBalanceMarkedToken(erc20Usdc())).toBe(true);
    expect(isSharedBalanceMarkedToken(nativeUsdc())).toBe(false);
    expect(isSharedBalanceMarkedToken({ sharedBalanceExcluded: true })).toBe(
      false,
    );
    expect(
      isSharedBalanceMarkedToken({
        sharedBalanceExcluded: false,
        sharedBalanceWith: '',
      }),
    ).toBe(false);
    expect(isSharedBalanceMarkedToken(undefined)).toBe(false);
  });
});

describe('resolveSharedBalanceExcludedKeys', () => {
  const primary = {
    key: NATIVE_KEY,
    networkId: ARC,
    address: '',
    price: 1,
    fiatValue: '1.45',
  };
  const member = {
    key: ERC20_KEY,
    networkId: ARC,
    address: '0x3600000000000000000000000000000000000000',
    sharedBalanceExcluded: true,
    sharedBalanceWith: '',
    price: 1,
    fiatValue: '1.45',
  };

  test('skips the marked row when a valid primary is in the set', () => {
    expect([...resolveSharedBalanceExcludedKeys([primary, member])]).toEqual([
      ERC20_KEY,
    ]);
  });

  test('re-includes the marked row when the primary is absent (hidden / blocked / contractList)', () => {
    expect(resolveSharedBalanceExcludedKeys([member]).size).toBe(0);
  });

  test('re-includes when the primary has no positive price', () => {
    expect(
      resolveSharedBalanceExcludedKeys([
        { ...primary, price: '0', fiatValue: '0' },
        member,
      ]).size,
    ).toBe(0);
    expect(
      resolveSharedBalanceExcludedKeys([
        { ...primary, price: undefined, fiatValue: undefined },
        member,
      ]).size,
    ).toBe(0);
  });

  test('priced primary with zero balance is still a valid primary', () => {
    expect(
      resolveSharedBalanceExcludedKeys([
        { ...primary, fiatValue: '0' },
        member,
      ]).has(ERC20_KEY),
    ).toBe(true);
  });

  test('matches primary by (networkId, address): Ethereum native ETH is not Arc primary', () => {
    expect(
      resolveSharedBalanceExcludedKeys([
        {
          key: 'evm--1_0xacc_native',
          networkId: 'evm--1',
          address: '',
          price: 4000,
          fiatValue: '10',
        },
        member,
      ]).size,
    ).toBe(0);
  });

  test('a marked row never acts as primary for another marked row', () => {
    expect(
      resolveSharedBalanceExcludedKeys([
        member,
        { ...member, key: 'dup', address: '' },
      ]).size,
    ).toBe(0);
  });

  test('unmarked tokens are never excluded', () => {
    expect(
      resolveSharedBalanceExcludedKeys([
        primary,
        { key: 'x', networkId: ARC, address: '0x1', price: 1, fiatValue: '1' },
      ]).size,
    ).toBe(0);
  });
});

describe('applySharedBalanceExclusionToTokenGroups', () => {
  test('flags the fiat entry, keeps data/keys/map intact, recomputes bucket fiatValue', () => {
    const tokens = group(
      [nativeUsdc(), erc20Usdc()],
      { [NATIVE_KEY]: fiat('1.45'), [ERC20_KEY]: fiat('1.45') },
      '2.9',
    );
    const smallBalanceTokens = group([], {}, '0');

    const excluded = applySharedBalanceExclusionToTokenGroups({
      tokens,
      smallBalanceTokens,
    });

    expect([...excluded]).toEqual([ERC20_KEY]);
    expect(tokens.data).toHaveLength(2);
    expect(tokens.keys).toBe(`${NATIVE_KEY},${ERC20_KEY}`);
    expect(Object.keys(tokens.map)).toEqual([NATIVE_KEY, ERC20_KEY]);
    expect(tokens.map[ERC20_KEY].fiatValue).toBe('1.45');
    expect(tokens.map[ERC20_KEY].sharedBalanceExcludedFromTotal).toBe(true);
    expect(tokens.map[NATIVE_KEY].sharedBalanceExcludedFromTotal).toBe(
      undefined,
    );
    expect(tokens.fiatValue).toBe('1.45');

    // Every map-only sum helper honours the flag.
    expect(sumFiatValuesIgnoringUnavailable(tokens.map)).toBe('1.45');
    expect(sumFiatValuesFromTokens(tokens.data, tokens.map).toFixed()).toBe(
      '1.45',
    );
    expect(
      sumTokenGroupsFiatValueIgnoringUnavailable({
        tokens,
        smallBalanceTokens,
      }),
    ).toBe('1.45');
  });

  test('looks up the primary across buckets: ERC-20 alone in smallBalanceTokens', () => {
    const tokens = group([nativeUsdc()], { [NATIVE_KEY]: fiat('100') }, '100');
    const smallBalanceTokens = group(
      [erc20Usdc()],
      { [ERC20_KEY]: fiat('100') },
      '100',
    );

    applySharedBalanceExclusionToTokenGroups({ tokens, smallBalanceTokens });

    expect(
      smallBalanceTokens.map[ERC20_KEY].sharedBalanceExcludedFromTotal,
    ).toBe(true);
    expect(smallBalanceTokens.fiatValue).toBe('0');
    expect(tokens.fiatValue).toBe('100');
    expect(
      sumTokenGroupsFiatValueIgnoringUnavailable({
        tokens,
        smallBalanceTokens,
      }),
    ).toBe('100');
  });

  test('only the ERC-20 row is held: total equals its own fiatValue', () => {
    const tokens = group([erc20Usdc()], { [ERC20_KEY]: fiat('7') }, '7');
    const smallBalanceTokens = group([], {}, '0');

    applySharedBalanceExclusionToTokenGroups({ tokens, smallBalanceTokens });

    expect(tokens.map[ERC20_KEY].sharedBalanceExcludedFromTotal).toBe(
      undefined,
    );
    expect(tokens.fiatValue).toBe('7');
    expect(
      sumTokenGroupsFiatValueIgnoringUnavailable({
        tokens,
        smallBalanceTokens,
      }),
    ).toBe('7');
  });

  test('primary present but unpriced: ERC-20 is counted instead', () => {
    const tokens = group(
      [nativeUsdc(), erc20Usdc()],
      { [NATIVE_KEY]: fiat('0', 0), [ERC20_KEY]: fiat('7') },
      '7',
    );
    applySharedBalanceExclusionToTokenGroups({ tokens });
    expect(tokens.map[ERC20_KEY].sharedBalanceExcludedFromTotal).toBe(
      undefined,
    );
    expect(tokens.fiatValue).toBe('7');
  });

  test('clears a stale flag when the primary disappears on a later round', () => {
    const erc20Fiat: ITokenFiat = {
      ...fiat('7'),
      sharedBalanceExcludedFromTotal: true,
    };
    const tokens = group([erc20Usdc()], { [ERC20_KEY]: erc20Fiat }, '0');
    applySharedBalanceExclusionToTokenGroups({ tokens });
    expect(erc20Fiat.sharedBalanceExcludedFromTotal).toBe(undefined);
    expect(tokens.fiatValue).toBe('7');
  });

  test('responses without markers are untouched (server bucket total kept verbatim)', () => {
    const eth: IAccountToken = {
      $key: 'evm--1_0xacc_native',
      address: '',
      decimals: 18,
      isNative: true,
      name: 'Ethereum',
      symbol: 'ETH',
      networkId: 'evm--1',
    };
    const tokens = group([eth], { [eth.$key]: fiat('10') }, '12.5');
    const before = JSON.stringify(tokens);

    const excluded = applySharedBalanceExclusionToTokenGroups({ tokens });

    expect(excluded.size).toBe(0);
    expect(JSON.stringify(tokens)).toBe(before);
  });
});

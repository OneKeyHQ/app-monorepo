import { getNetworkIdsMap } from '../config/networkIds';

import deriveTypeCollapseUtils from './deriveTypeCollapseUtils';

import type { IDeriveTypeAssetState } from './deriveTypeCollapseUtils';
import type { ITokenFiat } from '../../types/token';

/*
yarn jest packages/shared/src/utils/deriveTypeCollapseUtils.test.ts
*/

function buildStates(
  overrides: Record<string, Partial<IDeriveTypeAssetState>> = {},
): IDeriveTypeAssetState[] {
  return ['BIP86', 'default', 'BIP84', 'BIP44'].map((deriveType) => ({
    deriveType,
    hasBalanceRecord: true,
    hasAssets: false,
    ...overrides[deriveType],
  }));
}

function buildFiat(overrides: Partial<ITokenFiat> = {}): ITokenFiat {
  return {
    balance: '0',
    balanceParsed: '0',
    fiatValue: '0',
    price: 0,
    ...overrides,
  };
}

describe('shouldCollapseDeriveTypes', () => {
  it.each<[string, string | undefined, IDeriveTypeAssetState[], boolean]>([
    ['collapses a new wallet that holds nothing', 'BIP86', buildStates(), true],
    [
      'collapses when only the default type holds assets',
      'BIP86',
      buildStates({ BIP86: { hasAssets: true } }),
      true,
    ],
    [
      'collapses on a default type the user switched to',
      'BIP84',
      buildStates({ BIP84: { hasAssets: true } }),
      true,
    ],
    [
      'keeps every type when another type holds assets',
      'BIP86',
      buildStates({ default: { hasAssets: true } }),
      false,
    ],
    [
      'keeps every type when the assets stay on the previous default',
      'BIP84',
      buildStates({ BIP86: { hasAssets: true } }),
      false,
    ],
    [
      'treats a type whose balances were never read as unknown, not empty',
      'BIP86',
      buildStates({ BIP44: { hasBalanceRecord: false } }),
      false,
    ],
    [
      'requires a balance record for the default type too',
      'BIP86',
      buildStates({ BIP86: { hasBalanceRecord: false } }),
      false,
    ],
    [
      'does not collapse without a default type',
      undefined,
      buildStates(),
      false,
    ],
    ['does not collapse without any state', 'BIP86', [], false],
    [
      'does not collapse when the default type is not one of the states',
      'unknownType',
      buildStates(),
      false,
    ],
  ])('%s', (_name, defaultDeriveType, deriveTypeStates, expected) => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType,
        deriveTypeStates,
      }),
    ).toBe(expected);
  });
});

describe('hasAssetsInTokenListMap', () => {
  it('reports no assets for a missing or empty map', () => {
    expect(
      deriveTypeCollapseUtils.hasAssetsInTokenListMap({
        tokenListMap: undefined,
      }),
    ).toBe(false);
    expect(
      deriveTypeCollapseUtils.hasAssetsInTokenListMap({ tokenListMap: {} }),
    ).toBe(false);
  });

  it('reports no assets when every amount is zero', () => {
    expect(
      deriveTypeCollapseUtils.hasAssetsInTokenListMap({
        tokenListMap: { native: buildFiat() },
      }),
    ).toBe(false);
  });

  it('counts an amount with no fiat value', () => {
    expect(
      deriveTypeCollapseUtils.hasAssetsInTokenListMap({
        tokenListMap: { native: buildFiat({ balance: '546', fiatValue: '0' }) },
      }),
    ).toBe(true);
  });

  it('counts frozen and total balances', () => {
    expect(
      deriveTypeCollapseUtils.hasAssetsInTokenListMap({
        tokenListMap: { native: buildFiat({ frozenBalance: '330' }) },
      }),
    ).toBe(true);
    expect(
      deriveTypeCollapseUtils.hasAssetsInTokenListMap({
        tokenListMap: { native: buildFiat({ totalBalance: '330' }) },
      }),
    ).toBe(true);
  });

  it('ignores malformed amounts', () => {
    expect(
      deriveTypeCollapseUtils.hasAssetsInTokenListMap({
        tokenListMap: { native: buildFiat({ balance: 'NaN' }) },
      }),
    ).toBe(false);
  });
});

describe('isDeriveTypeCollapseSupportedNetwork', () => {
  it('supports Bitcoin mainnet only', () => {
    const networkIds = getNetworkIdsMap();
    expect(
      deriveTypeCollapseUtils.isDeriveTypeCollapseSupportedNetwork({
        networkId: networkIds.btc,
      }),
    ).toBe(true);
    expect(
      deriveTypeCollapseUtils.isDeriveTypeCollapseSupportedNetwork({
        networkId: networkIds.ltc,
      }),
    ).toBe(false);
    expect(
      deriveTypeCollapseUtils.isDeriveTypeCollapseSupportedNetwork({
        networkId: networkIds.tbtc,
      }),
    ).toBe(false);
    expect(
      deriveTypeCollapseUtils.isDeriveTypeCollapseSupportedNetwork({
        networkId: undefined,
      }),
    ).toBe(false);
  });
});

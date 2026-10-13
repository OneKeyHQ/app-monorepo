import { getNetworkIdsMap } from '../config/networkIds';

import deriveTypeCollapseUtils from './deriveTypeCollapseUtils';

import type { IDeriveTypeAssetState } from './deriveTypeCollapseUtils';
import type { ITokenFiat } from '../../types/token';

/*
yarn jest packages/shared/src/utils/deriveTypeCollapseUtils.test.ts
*/

function buildState(
  deriveType: string,
  overrides: Partial<IDeriveTypeAssetState> = {},
): IDeriveTypeAssetState {
  return {
    deriveType,
    hasAccount: true,
    hasBalanceRecord: true,
    hasAssets: false,
    ...overrides,
  };
}

function buildStates(
  overrides: Record<string, Partial<IDeriveTypeAssetState>> = {},
): IDeriveTypeAssetState[] {
  return ['BIP86', 'default', 'BIP84', 'BIP44'].map((deriveType) =>
    buildState(deriveType, overrides[deriveType]),
  );
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
  it('collapses a new wallet that holds nothing', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP86',
        deriveTypeStates: buildStates(),
      }),
    ).toBe(true);
  });

  it('collapses when only the default type holds assets', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP86',
        deriveTypeStates: buildStates({ BIP86: { hasAssets: true } }),
      }),
    ).toBe(true);
  });

  it('collapses on a default type the user switched to', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP84',
        deriveTypeStates: buildStates({ BIP84: { hasAssets: true } }),
      }),
    ).toBe(true);
  });

  it('keeps every type when another type holds assets', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP86',
        deriveTypeStates: buildStates({ default: { hasAssets: true } }),
      }),
    ).toBe(false);
  });

  it('keeps every type when the assets stay on the previous default', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP84',
        deriveTypeStates: buildStates({ BIP86: { hasAssets: true } }),
      }),
    ).toBe(false);
  });

  it('treats a type whose balances were never read as unknown, not empty', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP86',
        deriveTypeStates: buildStates({ BIP44: { hasBalanceRecord: false } }),
      }),
    ).toBe(false);
  });

  it('requires a balance record for the default type too', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP86',
        deriveTypeStates: buildStates({ BIP86: { hasBalanceRecord: false } }),
      }),
    ).toBe(false);
  });

  it('keeps every type when one of them has no account yet', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP86',
        deriveTypeStates: buildStates({ BIP84: { hasAccount: false } }),
      }),
    ).toBe(false);
  });

  it('does not collapse without a default type or without any state', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: undefined,
        deriveTypeStates: buildStates(),
      }),
    ).toBe(false);
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'BIP86',
        deriveTypeStates: [],
      }),
    ).toBe(false);
  });

  it('does not collapse when the default type is not one of the states', () => {
    expect(
      deriveTypeCollapseUtils.shouldCollapseDeriveTypes({
        defaultDeriveType: 'unknownType',
        deriveTypeStates: buildStates(),
      }),
    ).toBe(false);
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

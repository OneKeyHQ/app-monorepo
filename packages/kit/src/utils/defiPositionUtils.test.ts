import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDeFiAssetType,
  type IDeFiProtocol,
} from '@onekeyhq/shared/types/defi';

import {
  buildLocalizedProtocolPositionItems,
  buildProtocolCategoryGroups,
  getProtocolPositionDisplayName,
} from './defiPositionUtils';

type IProtocolPosition = IDeFiProtocol['positions'][number];
type IProtocolPositionAsset = IProtocolPosition['assets'][number];

function makeProtocol(category: string): IDeFiProtocol {
  return {
    protocol: 'aave',
    networkId: 'evm--1',
    owner: '0x1',
    categories: [],
    positions: [
      {
        groupId: 'position-1',
        category,
        poolName: 'Pool',
        poolFullName: 'Pool',
        value: '100',
        assets: [
          {
            address: '0xasset',
            symbol: 'USDC',
            value: 100,
            amount: '100',
            price: 1,
            type: EDeFiAssetType.ASSET,
            category,
            meta: {
              decimals: 6,
              isVerified: true,
            },
          },
        ],
        debts: [],
        rewards: [],
      },
    ],
  } as IDeFiProtocol;
}

function makeAsset({
  address,
  symbol,
  value,
  amount = String(value),
  type = EDeFiAssetType.ASSET,
  logoUrl,
}: {
  address: string;
  symbol: string;
  value: number;
  amount?: string;
  type?: EDeFiAssetType;
  logoUrl?: string;
}): IProtocolPositionAsset {
  return {
    address,
    symbol,
    value,
    amount,
    price: 1,
    type,
    category: 'asset',
    meta: {
      decimals: 18,
      isVerified: true,
      logoUrl,
    },
  };
}

function makePosition({
  groupId,
  category,
  poolName,
  assets = [],
  rewards = [],
  debts = [],
}: {
  groupId: string;
  category: string;
  poolName: string;
  assets?: IProtocolPositionAsset[];
  rewards?: IProtocolPositionAsset[];
  debts?: IProtocolPositionAsset[];
}): IProtocolPosition {
  return {
    groupId,
    category,
    poolName,
    poolFullName: poolName,
    value: '0',
    assets,
    debts,
    rewards,
  };
}

function makeMultiPositionProtocol(
  positions: IProtocolPosition[],
): IDeFiProtocol {
  return {
    protocol: 'multi',
    networkId: 'evm--1',
    owner: '0x1',
    categories: [],
    positions,
  } as IDeFiProtocol;
}

describe('defiPositionUtils', () => {
  it('localizes protocol position category labels', () => {
    const items = buildLocalizedProtocolPositionItems({
      protocol: makeProtocol('liquidity pool'),
      translate: (id) => `translated:${id}`,
    });

    expect(items[0].categoryLabel).toBe(
      `translated:${ETranslations.wallet_defi_position_module_liquidity_pool}`,
    );
    expect(items[0].sections[0].title).toBe(
      `translated:${ETranslations.wallet_defi_asset_type_supplied}`,
    );
  });

  it('falls back to poolFullName for placeholder poolName display', () => {
    expect(
      getProtocolPositionDisplayName({
        poolName: 'x',
        poolFullName: 'PT-USDe-30JUL2025',
      }),
    ).toBe('PT-USDe-30JUL2025');
  });
});

describe('buildProtocolCategoryGroups', () => {
  it('keeps lending positions un-merged so each one renders its own block', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'lend-a',
        category: 'lending',
        poolName: 'Aave Market',
        assets: [makeAsset({ address: '0xa', symbol: 'USDC', value: 100 })],
        debts: [
          {
            ...makeAsset({ address: '0xd', symbol: 'DAI', value: 30 }),
            type: EDeFiAssetType.DEBT,
          },
        ],
      }),
      makePosition({
        groupId: 'lend-b',
        category: 'lending',
        poolName: 'Aave Market',
        assets: [makeAsset({ address: '0xb', symbol: 'WBTC', value: 50_000 })],
      }),
    ]);

    const groups = buildProtocolCategoryGroups(protocol);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.kind).toBe('sectioned');
    if (group.kind !== 'sectioned') return;
    expect(group.positions).toHaveLength(2);
    expect(
      group.positions[0].sections.find((s) => s.assetType === 'borrowed'),
    ).toBeDefined();
  });

  it('merges non-lending positions sharing a poolName into one row', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'pendle-1',
        category: 'yield',
        poolName: 'PT-USDe-30JUL2025',
        assets: [makeAsset({ address: '0xa', symbol: 'sUSDe', value: 1500 })],
      }),
      makePosition({
        groupId: 'pendle-2',
        category: 'yield',
        poolName: 'PT-USDe-30JUL2025',
        assets: [makeAsset({ address: '0xb', symbol: 'USDe', value: 1000 })],
      }),
    ]);

    const groups = buildProtocolCategoryGroups(protocol);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.rows).toHaveLength(1);
    expect(group.rows[0].primaryAssets.map((a) => a.symbol)).toEqual([
      'sUSDe',
      'USDe',
    ]);
    expect(group.rows[0].rewardsExtraAssets).toHaveLength(0);
  });

  it('only fills rewardsExtraAssets when supplied + rewards both exist', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'p1',
        category: 'staked',
        poolName: 'sUSDe Staking',
        assets: [makeAsset({ address: '0xa', symbol: 'sUSDe', value: 1500 })],
        rewards: [
          {
            ...makeAsset({ address: '0xr', symbol: 'sUSDe', value: 8898 }),
            type: EDeFiAssetType.REWARD,
          },
        ],
      }),
    ]);

    const [group] = buildProtocolCategoryGroups(protocol);
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.rows[0].primaryAssets).toHaveLength(1);
    expect(group.rows[0].rewardsExtraAssets).toHaveLength(1);
    expect(group.rows[0].rewardsExtraAssets[0].symbol).toBe('sUSDe');
  });

  it('falls back to rewards bucket when a position has no supplied assets', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'p1',
        category: 'rewards',
        poolName: 'Airdrop',
        rewards: [
          {
            ...makeAsset({ address: '0xr', symbol: 'OP', value: 12 }),
            type: EDeFiAssetType.REWARD,
          },
        ],
      }),
    ]);

    const [group] = buildProtocolCategoryGroups(protocol);
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.rows[0].primaryAssets).toHaveLength(1);
    expect(group.rows[0].primaryAssets[0].symbol).toBe('OP');
    expect(group.rows[0].rewardsExtraAssets).toHaveLength(0);
  });

  it('builds an lp-stack display from supplied assets for liquidity_pool', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'lp-1',
        category: 'liquidity_pool',
        poolName: 'ETH/USDC',
        assets: [
          makeAsset({
            address: '0xa',
            symbol: 'ETH',
            value: 1500,
            logoUrl: 'eth.png',
          }),
          makeAsset({
            address: '0xb',
            symbol: 'USDC',
            value: 1500,
            logoUrl: 'usdc.png',
          }),
        ],
      }),
    ]);

    const [group] = buildProtocolCategoryGroups(protocol);
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.displayKind).toBe('lp-stack');
    expect(group.rows[0].positionDisplay).toEqual({
      kind: 'lp-stack',
      tokens: [
        { symbol: 'ETH', logoUrl: 'eth.png' },
        { symbol: 'USDC', logoUrl: 'usdc.png' },
      ],
      text: 'ETH + USDC',
    });
  });

  it('builds an icon-text display for deposit using the first supplied asset', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'd-1',
        category: 'deposit',
        poolName: 'ezETH Vault',
        assets: [
          makeAsset({
            address: '0xa',
            symbol: 'ezETH',
            value: 30_000,
            logoUrl: 'ezeth.png',
          }),
        ],
      }),
    ]);

    const [group] = buildProtocolCategoryGroups(protocol);
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.rows[0].positionDisplay).toEqual({
      kind: 'icon-text',
      text: 'ezETH Vault',
      iconUrl: 'ezeth.png',
    });
  });

  it('falls back to plain text for unspecified non-lending categories', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'y-1',
        category: 'yield',
        poolName: 'PT-USDe',
        assets: [makeAsset({ address: '0xa', symbol: 'sUSDe', value: 1 })],
      }),
    ]);

    const [group] = buildProtocolCategoryGroups(protocol);
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.rows[0].positionDisplay).toEqual({
      kind: 'text',
      text: 'PT-USDe',
    });
  });

  it('preserves first-seen category order across the protocol', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'p1',
        category: 'yield',
        poolName: 'A',
        assets: [makeAsset({ address: '0xa', symbol: 'A', value: 1 })],
      }),
      makePosition({
        groupId: 'p2',
        category: 'staked',
        poolName: 'B',
        assets: [makeAsset({ address: '0xb', symbol: 'B', value: 1 })],
      }),
      makePosition({
        groupId: 'p3',
        category: 'yield',
        poolName: 'C',
        assets: [makeAsset({ address: '0xc', symbol: 'C', value: 1 })],
      }),
    ]);

    const groups = buildProtocolCategoryGroups(protocol);
    expect(groups.map((g) => g.groupKey)).toEqual(['yield', 'staked']);
  });

  it('routes a non-lending debt-bearing position to its own sectioned group', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'lf-1',
        category: 'leveraged_farming',
        poolName: 'ETH/USDC LP 3x',
        assets: [makeAsset({ address: '0xs', symbol: 'ETH', value: 4000 })],
        debts: [
          {
            ...makeAsset({ address: '0xd', symbol: 'USDC', value: 2000 }),
            type: EDeFiAssetType.DEBT,
          },
        ],
        rewards: [
          {
            ...makeAsset({ address: '0xr', symbol: 'CAKE', value: 25 }),
            type: EDeFiAssetType.REWARD,
          },
        ],
      }),
    ]);

    const groups = buildProtocolCategoryGroups(protocol);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.kind).toBe('sectioned');
    if (group.kind !== 'sectioned') return;
    expect(group.positions).toHaveLength(1);
    const sections = group.positions[0].sections;
    const borrowed = sections.find((s) => s.assetType === 'borrowed');
    expect(borrowed?.assets.map((a) => a.symbol)).toEqual(['USDC']);
    const supplied = sections.find((s) => s.assetType === 'supplied');
    expect(supplied?.assets.map((a) => a.symbol)).toEqual(['ETH']);
    const rewards = sections.find((s) => s.assetType === 'rewards');
    expect(rewards?.assets.map((a) => a.symbol)).toEqual(['CAKE']);
  });

  it('emits two separate adjacent groups when a non-lending category mixes clean and debt-bearing positions', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'lf-clean',
        category: 'leveraged_farming',
        poolName: 'Pool A',
        assets: [makeAsset({ address: '0xa', symbol: 'CAKE', value: 500 })],
      }),
      makePosition({
        groupId: 'lf-debt',
        category: 'leveraged_farming',
        poolName: 'Pool B',
        assets: [makeAsset({ address: '0xb', symbol: 'ETH', value: 4000 })],
        debts: [
          {
            ...makeAsset({ address: '0xd', symbol: 'USDC', value: 2000 }),
            type: EDeFiAssetType.DEBT,
          },
        ],
      }),
    ]);

    const groups = buildProtocolCategoryGroups(protocol);
    // Two groups, both with the Leveraged farming label so the badges
    // read as a continued surface; the `:debt` suffix on the second
    // group's key keeps React from deduping them and signals to the
    // renderer that this is the debt-bearing variant.
    expect(groups).toHaveLength(2);
    const [clean, debt] = groups;
    expect(clean.groupKey).toBe('leveraged_farming');
    expect(debt.groupKey).toBe('leveraged_farming:debt');
    expect(clean.categoryLabel).toBe(debt.categoryLabel);
    expect(clean.kind).toBe('unified');
    if (clean.kind !== 'unified') return;
    expect(clean.rows).toHaveLength(1);
    expect(clean.rows[0].positionDisplay).toEqual({
      kind: 'text',
      text: 'Pool A',
    });
    expect(debt.kind).toBe('sectioned');
    if (debt.kind !== 'sectioned') return;
    expect(debt.positions).toHaveLength(1);
    expect(debt.positions[0].poolName).toBe('Pool B');
  });

  it('does not merge non-lending positions whose poolName is a placeholder', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'fx-1',
        category: 'staked',
        poolName: 'x',
        assets: [makeAsset({ address: '0xa', symbol: 'FXN', value: 0.1 })],
      }),
      makePosition({
        groupId: 'fx-2',
        category: 'staked',
        poolName: 'x',
        assets: [makeAsset({ address: '0xb', symbol: 'cvxFXN', value: 0.2 })],
      }),
    ]);

    const [group] = buildProtocolCategoryGroups(protocol);
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    // Two distinct rows — without sanitization both would have collapsed
    // into one row keyed by `name:x`.
    expect(group.rows).toHaveLength(2);
    // And neither row prints "x" — they fall back to the symbol-join,
    // which here is just the single asset symbol.
    expect(
      group.rows.map((r) => (r.positionDisplay as { text: string }).text),
    ).toEqual(['FXN', 'cvxFXN']);
  });

  it('falls back to poolFullName for the unified row label when poolName is a placeholder', () => {
    // Hand-built so poolName ≠ poolFullName (the helper sets them equal).
    const position: IProtocolPosition = {
      groupId: 'fx-3',
      category: 'staked',
      poolName: 'x',
      poolFullName: 'f(x) ETH/fxUSD Vault',
      value: '1000',
      assets: [makeAsset({ address: '0xa', symbol: 'ETH', value: 1000 })],
      debts: [],
      rewards: [],
    };

    const [group] = buildProtocolCategoryGroups(
      makeMultiPositionProtocol([position]),
    );
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.rows[0].positionDisplay).toEqual({
      kind: 'text',
      text: 'f(x) ETH/fxUSD Vault',
    });
  });

  it('does not collapse same-poolName positions when both carry debts', () => {
    // Sibling positions on the same pool that both carry debts must each
    // render as their own row inside the sectioned debt group —
    // collapsing would average away per-position risk that the user needs
    // to see.
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'lf-1',
        category: 'leveraged_farming',
        poolName: 'Same Pool',
        assets: [makeAsset({ address: '0xa', symbol: 'ETH', value: 4000 })],
        debts: [
          {
            ...makeAsset({ address: '0xd1', symbol: 'USDC', value: 2000 }),
            type: EDeFiAssetType.DEBT,
          },
        ],
      }),
      makePosition({
        groupId: 'lf-2',
        category: 'leveraged_farming',
        poolName: 'Same Pool',
        assets: [makeAsset({ address: '0xb', symbol: 'BTC', value: 50_000 })],
        debts: [
          {
            ...makeAsset({ address: '0xd2', symbol: 'USDT', value: 25_000 }),
            type: EDeFiAssetType.DEBT,
          },
        ],
      }),
    ]);

    const groups = buildProtocolCategoryGroups(protocol);
    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.kind).toBe('sectioned');
    if (group.kind !== 'sectioned') return;
    expect(group.positions).toHaveLength(2);
    expect(group.positions.map((p) => p.groupId)).toEqual(['lf-1', 'lf-2']);
  });
});

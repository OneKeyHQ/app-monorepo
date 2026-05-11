import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDeFiAssetType,
  type IDeFiProtocol,
} from '@onekeyhq/shared/types/defi';

import {
  buildLocalizedProtocolPositionItems,
  buildProtocolCategoryGroups,
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
  value = '0',
  assets = [],
  rewards = [],
  debts = [],
}: {
  groupId: string;
  category: string;
  poolName: string;
  value?: string;
  assets?: IProtocolPositionAsset[];
  rewards?: IProtocolPositionAsset[];
  debts?: IProtocolPositionAsset[];
}): IProtocolPosition {
  return {
    groupId,
    category,
    poolName,
    poolFullName: poolName,
    value,
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

    const [group] = buildProtocolCategoryGroups(protocol);

    expect(group.kind).toBe('lending');
    if (group.kind !== 'lending') return;
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
        value: '1500.25',
        assets: [makeAsset({ address: '0xa', symbol: 'sUSDe', value: 1500 })],
      }),
      makePosition({
        groupId: 'pendle-2',
        category: 'yield',
        poolName: 'PT-USDe-30JUL2025',
        value: '999.75',
        assets: [makeAsset({ address: '0xb', symbol: 'USDe', value: 1000 })],
      }),
    ]);

    const [group] = buildProtocolCategoryGroups(protocol);
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.rows).toHaveLength(1);
    expect(group.rows[0].primaryAssets.map((a) => a.symbol)).toEqual([
      'sUSDe',
      'USDe',
    ]);
    expect(group.rows[0].netValue).toBe('2500');
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

  it('keeps borrowed assets on non-lending unified rows', () => {
    const protocol = makeMultiPositionProtocol([
      makePosition({
        groupId: 'farm-1',
        category: 'leveraged_farming',
        poolName: 'Leveraged ETH Farm',
        value: '1000',
        assets: [makeAsset({ address: '0xa', symbol: 'ETH', value: 1500 })],
        debts: [
          {
            ...makeAsset({ address: '0xd', symbol: 'USDC', value: 500 }),
            type: EDeFiAssetType.DEBT,
          },
        ],
      }),
    ]);

    const [group] = buildProtocolCategoryGroups(protocol);
    expect(group.kind).toBe('unified');
    if (group.kind !== 'unified') return;
    expect(group.rows[0].primaryAssets.map((a) => a.symbol)).toEqual(['ETH']);
    expect(group.rows[0].borrowedAssets.map((a) => a.symbol)).toEqual(['USDC']);
    expect(group.rows[0].netValue).toBe('1000');
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
});

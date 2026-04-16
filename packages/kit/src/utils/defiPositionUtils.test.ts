import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDeFiAssetType,
  type IDeFiProtocol,
} from '@onekeyhq/shared/types/defi';

import { buildProtocolPositionItems } from './defiPositionUtils';

function createProtocolPosition(
  category: string,
  overrides: Partial<IDeFiProtocol['positions'][number]> = {},
): IDeFiProtocol {
  return {
    networkId: 'evm--1',
    owner: '0xowner',
    protocol: 'aave',
    categories: [category],
    positions: [
      {
        category,
        categories: [category],
        groupId: 'group-1',
        poolName: 'Main Pool',
        poolFullName: 'Main Pool',
        value: '123',
        assets: [
          {
            symbol: 'ETH',
            address: '0xeth',
            amount: '1',
            value: 100,
            price: 100,
            category,
            meta: {
              decimals: 18,
              isVerified: true,
            },
            type: EDeFiAssetType.ASSET,
          },
        ],
        debts: [
          {
            symbol: 'USDC',
            address: '0xusdc',
            amount: '10',
            value: 10,
            price: 1,
            category,
            meta: {
              decimals: 6,
              isVerified: true,
            },
            type: EDeFiAssetType.DEBT,
          },
        ],
        rewards: [
          {
            symbol: 'AAVE',
            address: '0xaave',
            amount: '0.5',
            value: 13,
            price: 26,
            category,
            meta: {
              decimals: 18,
              isVerified: true,
            },
            type: EDeFiAssetType.REWARD,
          },
        ],
        ...overrides,
      },
    ],
  };
}

describe('buildProtocolPositionItems', () => {
  it('maps the protocol module badge to the configured translation id', () => {
    const [position] = buildProtocolPositionItems(
      createProtocolPosition('lending'),
    );

    expect(position.categoryTitleId).toBe(
      ETranslations.wallet_defi_position_module_lending,
    );
    expect(position.categoryLabel).toBe('Lending');
  });

  it('aliases legacy module values to the current translation mapping', () => {
    const [position] = buildProtocolPositionItems(
      createProtocolPosition('liquidity'),
    );

    expect(position.categoryTitleId).toBe(
      ETranslations.wallet_defi_position_module_liquidity_pool,
    );
    expect(position.categoryLabel).toBe('Liquidity pool');
  });

  it('maps collateral subtype categories into supplied, borrowed, and rewards sections', () => {
    const [position] = buildProtocolPositionItems(
      createProtocolPosition('lending', {
        assets: [
          {
            symbol: 'ETH',
            address: '0xeth',
            amount: '1',
            value: 100,
            price: 100,
            category: 'deposit',
            meta: {
              decimals: 18,
              isVerified: true,
            },
            type: EDeFiAssetType.ASSET,
          },
          {
            symbol: 'stETH',
            address: '0xsteth',
            amount: '2',
            value: 90,
            price: 45,
            category: 'locked',
            meta: {
              decimals: 18,
              isVerified: true,
            },
            type: EDeFiAssetType.ASSET,
          },
        ],
        debts: [
          {
            symbol: 'USDC',
            address: '0xusdc',
            amount: '10',
            value: 10,
            price: 1,
            category: 'loan',
            meta: {
              decimals: 6,
              isVerified: true,
            },
            type: EDeFiAssetType.DEBT,
          },
        ],
        rewards: [
          {
            symbol: 'AAVE',
            address: '0xaave',
            amount: '0.5',
            value: 13,
            price: 26,
            category: 'reward',
            meta: {
              decimals: 18,
              isVerified: true,
            },
            type: EDeFiAssetType.REWARD,
          },
        ],
      }),
    );

    expect(position.sections.map((section) => section.titleId)).toEqual([
      ETranslations.wallet_defi_asset_type_supplied,
      ETranslations.wallet_defi_asset_type_borrowed,
      ETranslations.wallet_defi_position_module_rewards,
    ]);
    expect(position.sections[0].assets.map((asset) => asset.category)).toEqual([
      'deposit',
      'locked',
    ]);
  });

  it('builds stable position keys when multiple positions share the same group id', () => {
    const protocol = createProtocolPosition('farming');
    protocol.positions = [
      protocol.positions[0],
      {
        ...protocol.positions[0],
        category: 'staked',
        categories: ['staked'],
      },
    ];

    expect(
      buildProtocolPositionItems(protocol).map(
        (position) => position.positionKey,
      ),
    ).toEqual(['group-1-farming', 'group-1-staked']);
  });
});

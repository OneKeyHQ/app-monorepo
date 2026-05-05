import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EDeFiAssetType,
  type IDeFiProtocol,
} from '@onekeyhq/shared/types/defi';

import { buildLocalizedProtocolPositionItems } from './defiPositionUtils';

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

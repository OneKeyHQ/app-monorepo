import {
  EDeFiAssetType,
  type IDeFiAsset,
  type IDeFiProtocol,
} from '@onekeyhq/shared/types/defi';

import {
  getProtocolPositionSectionsValueState,
  getProtocolValueState,
  isProtocolAssetValueUnavailable,
} from './protocolValueUtils';

function makeAsset(overrides: Partial<IDeFiAsset> = {}): IDeFiAsset {
  return {
    symbol: 'USDC',
    address: '0xasset',
    amount: '1',
    value: 1,
    price: 1,
    category: 'asset',
    meta: {
      decimals: 6,
      isVerified: true,
    },
    ...overrides,
  };
}

function makeProtocolAsset(
  type: EDeFiAssetType,
  overrides: Partial<IDeFiAsset> = {},
): IDeFiAsset & { type: EDeFiAssetType } {
  return {
    ...makeAsset(overrides),
    type,
  };
}

describe('protocolValueUtils', () => {
  it('keeps a finite non-zero asset value even when price is unavailable', () => {
    const valuedAssetWithMissingPrice = makeAsset({
      symbol: 'VALUED',
      amount: '2',
      price: 0,
      value: 10,
    });

    expect(isProtocolAssetValueUnavailable(valuedAssetWithMissingPrice)).toBe(
      false,
    );
    expect(
      getProtocolPositionSectionsValueState([
        {
          assetType: 'supplied',
          assets: [valuedAssetWithMissingPrice],
        },
      ]),
    ).toEqual({
      value: 10,
      hasAvailableValue: true,
      hasUnavailableValue: false,
    });
  });

  it('subtracts borrowed sections while keeping partial available value', () => {
    expect(
      getProtocolPositionSectionsValueState([
        {
          assetType: 'supplied',
          assets: [
            makeAsset({ symbol: 'USDC', value: 10 }),
            makeAsset({ symbol: 'UNKNOWN', amount: '2', price: 0, value: 0 }),
          ],
        },
        {
          assetType: 'borrowed',
          assets: [makeAsset({ symbol: 'DAI', value: 3 })],
        },
        {
          assetType: 'rewards',
          assets: [makeAsset({ symbol: 'OP', value: 1 })],
        },
      ]),
    ).toEqual({
      value: 8,
      hasAvailableValue: true,
      hasUnavailableValue: true,
    });
  });

  it('aggregates protocol positions with rewards and debts', () => {
    const protocol: Pick<IDeFiProtocol, 'positions'> = {
      positions: [
        {
          category: 'lend',
          assets: [
            makeProtocolAsset(EDeFiAssetType.ASSET, {
              symbol: 'USDC',
              value: 10,
            }),
            makeProtocolAsset(EDeFiAssetType.ASSET, {
              symbol: 'UNKNOWN',
              amount: '2',
              price: 0,
              value: 0,
            }),
          ],
          debts: [
            makeProtocolAsset(EDeFiAssetType.DEBT, {
              symbol: 'DAI',
              value: 3,
            }),
          ],
          rewards: [
            makeProtocolAsset(EDeFiAssetType.REWARD, {
              symbol: 'OP',
              value: 1,
            }),
          ],
          value: '8',
          groupId: 'position-1',
          poolName: 'USDC',
          poolFullName: 'USDC Pool',
        },
      ],
    };

    expect(getProtocolValueState(protocol)).toEqual({
      value: 8,
      hasAvailableValue: true,
      hasUnavailableValue: true,
    });
  });
});

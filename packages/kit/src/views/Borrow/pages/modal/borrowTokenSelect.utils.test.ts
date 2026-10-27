import type {
  IBorrowAsset,
  IBorrowReserveItem,
} from '@onekeyhq/shared/types/staking';

import { filterUnavailableSupplyAssets } from './borrowTokenSelect.utils';

const asset = (reserveAddress: string, symbol: string) =>
  ({
    reserveAddress,
    token: { symbol },
  }) as IBorrowAsset;

const supplyAsset = (reserveAddress: string, disabled = false) =>
  ({
    reserveAddress,
    supplyButton: { disabled },
  }) as IBorrowReserveItem['supply']['assets'][number];

describe('filterUnavailableSupplyAssets', () => {
  it('keeps only reserves exposed by the actionable supply response', () => {
    const expired = asset('0xExpired', 'PT-eUSDE-29MAY2025');
    const available = asset('0xUSDC', 'USDC');

    expect(
      filterUnavailableSupplyAssets({
        assets: [expired, available],
        supplyAssets: [supplyAsset('0xusdc')],
        networkId: 'evm--1',
      }),
    ).toEqual([available]);
  });

  it('excludes reserves explicitly disabled for supply', () => {
    const disabled = asset('0xDisabled', 'DISABLED');

    expect(
      filterUnavailableSupplyAssets({
        assets: [disabled],
        supplyAssets: [supplyAsset('0xDisabled', true)],
        networkId: 'evm--1',
      }),
    ).toEqual([]);
  });

  it('never admits unverified assets when reserves are unavailable', () => {
    const assets = [asset('SoLaNaAddress', 'SOL')];

    expect(
      filterUnavailableSupplyAssets({
        assets,
        supplyAssets: undefined,
        networkId: 'sol--101',
      }),
    ).toEqual([]);
  });

  it('preserves case-sensitive Solana reserve identity', () => {
    const available = asset('SoLaNaAddress', 'SOL');
    expect(
      filterUnavailableSupplyAssets({
        assets: [available, asset('solanaaddress', 'OTHER')],
        supplyAssets: [supplyAsset('SoLaNaAddress')],
        networkId: 'sol--101',
      }),
    ).toEqual([available]);
  });
});

import {
  EDeFiPositionAction,
  type IDeFiAsset,
  type IResolvedDeFiPositionAction,
} from '@onekeyhq/shared/types/defi';

import { findResolvedActionRefreshMatch } from './protocolPositionActionButtonUtils';

function makeAsset({
  address,
  symbol = 'USDC',
}: {
  address: string;
  symbol?: string;
}): IDeFiAsset {
  return {
    symbol,
    address,
    amount: '1',
    value: 1,
    price: 1,
    category: 'deposit',
    meta: {
      decimals: 6,
      isVerified: true,
    },
  };
}

function makeWithdrawAction({
  poolAddress,
  tokenAddress = '0xusdc',
}: {
  poolAddress?: string;
  tokenAddress?: string;
}): IResolvedDeFiPositionAction {
  return {
    action: EDeFiPositionAction.Withdraw,
    protocolId: 'morphoblue',
    networkId: 'evm--1',
    positionCategory: 'yield',
    assetCategory: 'deposit',
    assets: [
      {
        asset: makeAsset({ address: tokenAddress }),
        amount: '1',
        symbol: 'USDC',
        tokenAddress,
        extraParams: poolAddress ? { poolAddress } : undefined,
      },
    ],
  };
}

describe('findResolvedActionRefreshMatch', () => {
  it('prefers pool identity over token overlap for same-token multi-pool refreshes', () => {
    const staleAction = makeWithdrawAction({ poolAddress: '0xpool-a' });
    const wrongSameTokenPool = makeWithdrawAction({ poolAddress: '0xpool-b' });
    const correctPool = makeWithdrawAction({ poolAddress: '0xpool-a' });

    expect(
      findResolvedActionRefreshMatch({
        staleAction,
        freshActions: [wrongSameTokenPool, correctPool],
      }),
    ).toBe(correctPool);
  });

  it('does not fall back to token overlap when stale action has a stable identity but no fresh action matches it', () => {
    const staleAction = makeWithdrawAction({ poolAddress: '0xpool-a' });
    const wrongSameTokenPool = makeWithdrawAction({ poolAddress: '0xpool-b' });

    expect(
      findResolvedActionRefreshMatch({
        staleAction,
        freshActions: [wrongSameTokenPool],
      }),
    ).toBeUndefined();
  });

  it('falls back to token overlap when stable identity is unavailable', () => {
    const staleAction = makeWithdrawAction({});
    const differentToken = makeWithdrawAction({ tokenAddress: '0xweth' });
    const sameToken = makeWithdrawAction({});

    expect(
      findResolvedActionRefreshMatch({
        staleAction,
        freshActions: [differentToken, sameToken],
      }),
    ).toBe(sameToken);
  });
});

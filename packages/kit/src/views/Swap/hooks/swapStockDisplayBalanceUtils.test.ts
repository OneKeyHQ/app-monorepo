import { resolveStockSnapshotBalanceForDisplay } from './swapStockDisplayBalanceUtils';
import { SWAP_STOCK_DISPLAY_BALANCE_MAX_AGE_MS } from './swapStockDisplaySnapshotUtils';

const displayInputToken = {
  networkId: 'evm--1',
  contractAddress: '0x-pay',
  symbol: 'USDC',
  decimals: 6,
};

function buildSnapshotBalance({
  accountKey = 'account-1',
  inputTokenKey = 'evm--1:0x-pay:token',
}: {
  accountKey?: string;
  inputTokenKey?: string;
} = {}) {
  return {
    identity: { accountKey, inputTokenKey },
    inputTokenKey,
    value: '12.5',
    updatedAt: Date.now(),
  };
}

describe('resolveStockSnapshotBalanceForDisplay', () => {
  it('uses the exact display token snapshot without a hydrated execution token', () => {
    const executionInputToken = undefined;
    const now = Date.now();

    expect(executionInputToken).toBeUndefined();
    expect(
      resolveStockSnapshotBalanceForDisplay({
        displayAccountKey: 'account-1',
        displayInputToken,
        now,
        snapshotBalance: {
          ...buildSnapshotBalance(),
          updatedAt: now,
        },
      }),
    ).toMatchObject({ value: '12.5' });
  });

  it.each([
    {
      name: 'another account',
      displayAccountKey: 'account-2',
      displayInputToken,
      snapshotBalance: buildSnapshotBalance(),
    },
    {
      name: 'another token',
      displayAccountKey: 'account-1',
      displayInputToken: {
        ...displayInputToken,
        contractAddress: '0x-other',
      },
      snapshotBalance: buildSnapshotBalance(),
    },
  ])('rejects a snapshot owned by $name', (params) => {
    expect(
      resolveStockSnapshotBalanceForDisplay({
        ...params,
      }),
    ).toBeUndefined();
  });

  it('accepts the exact age boundary and rejects an older display snapshot', () => {
    const now = Date.now();

    expect(
      resolveStockSnapshotBalanceForDisplay({
        displayAccountKey: 'account-1',
        displayInputToken,
        now,
        snapshotBalance: {
          ...buildSnapshotBalance(),
          updatedAt: now - SWAP_STOCK_DISPLAY_BALANCE_MAX_AGE_MS,
        },
      }),
    ).toMatchObject({ value: '12.5' });
    expect(
      resolveStockSnapshotBalanceForDisplay({
        displayAccountKey: 'account-1',
        displayInputToken,
        now,
        snapshotBalance: {
          ...buildSnapshotBalance(),
          updatedAt: now - SWAP_STOCK_DISPLAY_BALANCE_MAX_AGE_MS - 1,
        },
      }),
    ).toBeUndefined();
  });

  it('keeps an exact display snapshot while live execution balance stays separate', () => {
    expect(
      resolveStockSnapshotBalanceForDisplay({
        displayAccountKey: 'account-1',
        displayInputToken,
        snapshotBalance: buildSnapshotBalance(),
      }),
    ).toMatchObject({ value: '12.5' });
  });
});

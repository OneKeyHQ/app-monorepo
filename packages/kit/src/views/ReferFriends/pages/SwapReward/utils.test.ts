import type {
  ISwapInviteItem,
  ISwapInvitesResponse,
  ISwapRecordItem,
} from '@onekeyhq/shared/src/referralCode/type';

import {
  appendSwapInvitePage,
  getNextSwapCursor,
  groupSwapRecords,
} from './utils';

const token = {
  networkId: 'evm--1',
  address: '0xtoken',
  logoURI: 'https://example.com/token.png',
  name: 'USD Coin',
  symbol: 'USDC',
};

function buildInviteItem(id: string): ISwapInviteItem {
  return {
    _id: id,
    address: '0x12...7890',
    invitationTime: null,
    inviteCode: 'ONEKEY',
    inviteCodeRemark: '',
    firstTradeTime: null,
    volume: '1',
    volumeFiatValue: '1',
    fee: '0.01',
    feeFiatValue: '0.01',
    reward: '0.005',
    rewardFiatValue: '0.005',
    hasUndistributed: true,
    token,
  };
}

function buildPage({
  cursor,
  items,
}: {
  cursor: string | null;
  items: ISwapInviteItem[];
}): ISwapInvitesResponse {
  return {
    total: items.length,
    cursor,
    items,
  };
}

describe('Swap reward helpers', () => {
  it('preserves opaque rows without deduplicating matching response IDs', () => {
    const first = buildInviteItem('opaque-id');
    const second = buildInviteItem('opaque-id');

    const result = appendSwapInvitePage({
      current: buildPage({ cursor: 'cursor-1', items: [first] }),
      next: buildPage({ cursor: 'cursor-2', items: [second] }),
    });

    expect(result.items).toEqual([first, second]);
    expect(result.cursor).toBe('cursor-2');
  });

  it('returns server cursors byte-for-byte and stops a non-advancing cursor', () => {
    const opaqueCursor = 'opaque/+ cursor==';

    expect(
      getNextSwapCursor({
        requestedCursor: 'previous cursor',
        responseCursor: opaqueCursor,
      }),
    ).toBe(opaqueCursor);
    expect(
      getNextSwapCursor({
        requestedCursor: opaqueCursor,
        responseCursor: opaqueCursor,
      }),
    ).toBeUndefined();
  });

  it('groups same-month statuses without losing the original records', () => {
    const pending: ISwapRecordItem = {
      address: '0x12...7890',
      period: '2026-07',
      tradingVolume: '100',
      tradingVolumeFiatValue: '100',
      amount: '1',
      amountFiatValue: '1',
      token,
      status: 'PENDING',
      distributedTx: null,
    };
    const available: ISwapRecordItem = {
      ...pending,
      tradingVolume: '80',
      tradingVolumeFiatValue: '80',
      amount: '0.8',
      amountFiatValue: '0.8',
      token: { ...token },
      status: 'AVAILABLE',
      distributedTx: '0xdistribution',
    };

    const groups = groupSwapRecords([pending, available]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.period).toBe('2026-07');
    expect(groups[0]?.items).toEqual([pending, available]);
  });

  it('does not group records with different tokens', () => {
    const record: ISwapRecordItem = {
      address: '0x12...7890',
      period: '2026-07',
      tradingVolume: '100',
      tradingVolumeFiatValue: '100',
      amount: '1',
      amountFiatValue: '1',
      token,
      status: 'PENDING',
      distributedTx: null,
    };

    const groups = groupSwapRecords([
      record,
      {
        ...record,
        token: {
          ...token,
          address: '0xother-token',
          symbol: 'USDT',
        },
        status: 'AVAILABLE',
      },
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.items)).toEqual([
      [record],
      [
        expect.objectContaining({
          token: expect.objectContaining({ address: '0xother-token' }),
        }),
      ],
    ]);
  });

  it('does not group records from different months', () => {
    const record: ISwapRecordItem = {
      address: '0x12...7890',
      period: '2026-07',
      tradingVolume: '100',
      tradingVolumeFiatValue: '100',
      amount: '1',
      amountFiatValue: '1',
      token,
      status: 'PENDING',
      distributedTx: null,
    };

    const nextMonth = {
      ...record,
      period: '2026-08',
      status: 'ARCHIVE' as const,
      distributedTx: '0xarchive',
    };
    const groups = groupSwapRecords([record, nextMonth]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.period)).toEqual(['2026-07', '2026-08']);
    expect(groups.map((group) => group.items)).toEqual([[record], [nextMonth]]);
  });
});

import type {
  ISwapInviteItem,
  ISwapInvitesResponse,
} from '@onekeyhq/shared/src/referralCode/type';

import { appendSwapInvitePage, getNextSwapCursor } from './utils';

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
});

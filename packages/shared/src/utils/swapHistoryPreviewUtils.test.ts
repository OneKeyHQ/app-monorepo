import type { ISwapTxHistory } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapExtraStatus,
  ESwapTxHistoryStatus,
} from '@onekeyhq/shared/types/swap/types';

import {
  getSwapHistoryPreviewBadgeKind,
  markUnreadTerminalAsRead,
  selectSwapHistoryPreviewItems,
} from './swapHistoryPreviewUtils';

function makeItem(p: {
  status: ESwapTxHistoryStatus;
  created: number;
  previewReadAt?: number;
  extraStatus?: ESwapExtraStatus;
}): ISwapTxHistory {
  return {
    status: p.status,
    extraStatus: p.extraStatus,
    previewReadAt: p.previewReadAt,
    date: { created: p.created, updated: p.created },
  } as unknown as ISwapTxHistory;
}

describe('swapHistoryPreviewUtils', () => {
  describe('getSwapHistoryPreviewBadgeKind', () => {
    it('maps in-flight and terminal statuses to badge kinds', () => {
      expect(
        getSwapHistoryPreviewBadgeKind(
          makeItem({ status: ESwapTxHistoryStatus.PENDING, created: 1 }),
        ),
      ).toBe('pending');
      expect(
        getSwapHistoryPreviewBadgeKind(
          makeItem({ status: ESwapTxHistoryStatus.CANCELING, created: 1 }),
        ),
      ).toBe('pending');
      expect(
        getSwapHistoryPreviewBadgeKind(
          makeItem({ status: ESwapTxHistoryStatus.FAILED, created: 1 }),
        ),
      ).toBe('failed');
      expect(
        getSwapHistoryPreviewBadgeKind(
          makeItem({ status: ESwapTxHistoryStatus.CANCELED, created: 1 }),
        ),
      ).toBe('canceled');
      expect(
        getSwapHistoryPreviewBadgeKind(
          makeItem({ status: ESwapTxHistoryStatus.SUCCESS, created: 1 }),
        ),
      ).toBe('none');
      expect(
        getSwapHistoryPreviewBadgeKind(
          makeItem({
            status: ESwapTxHistoryStatus.PARTIALLY_FILLED,
            created: 1,
          }),
        ),
      ).toBe('none');
      // HOLD needs user attention and must win over a non-terminal status
      // (otherwise it would render as a generic blue "Pending").
      expect(
        getSwapHistoryPreviewBadgeKind(
          makeItem({
            status: ESwapTxHistoryStatus.PENDING,
            created: 1,
            extraStatus: ESwapExtraStatus.HOLD,
          }),
        ),
      ).toBe('hold');
    });
  });

  describe('selectSwapHistoryPreviewItems', () => {
    it('orders in-flight and unread terminal purely by created desc, capped, excluding read', () => {
      const items = [
        makeItem({ status: ESwapTxHistoryStatus.SUCCESS, created: 100 }), // unread terminal, newest
        makeItem({ status: ESwapTxHistoryStatus.PENDING, created: 50 }), // in-flight, oldest
        makeItem({ status: ESwapTxHistoryStatus.PENDING, created: 90 }), // in-flight
        makeItem({
          status: ESwapTxHistoryStatus.FAILED,
          created: 200,
          previewReadAt: 999,
        }), // read terminal -> excluded
      ];
      const result = selectSwapHistoryPreviewItems(items, 2);
      // pure newest-first: a completed item (100) can outrank a pending one (90)
      expect(result.map((i) => i.date.created)).toEqual([100, 90]);
    });

    it('keeps a just-completed newer item above an older pending one (stability)', () => {
      const items = [
        makeItem({ status: ESwapTxHistoryStatus.SUCCESS, created: 1005 }), // SOL: newer, just finished
        makeItem({ status: ESwapTxHistoryStatus.PENDING, created: 1000 }), // BTC: older, still pending
      ];
      const result = selectSwapHistoryPreviewItems(items, 2);
      expect(result.map((i) => i.date.created)).toEqual([1005, 1000]);
    });

    it('excludes read terminal items', () => {
      const items = [
        makeItem({ status: ESwapTxHistoryStatus.SUCCESS, created: 10 }),
        makeItem({ status: ESwapTxHistoryStatus.FAILED, created: 30 }),
        makeItem({
          status: ESwapTxHistoryStatus.SUCCESS,
          created: 40,
          previewReadAt: 1,
        }),
      ];
      const result = selectSwapHistoryPreviewItems(items, 2);
      expect(result.map((i) => i.date.created)).toEqual([30, 10]);
    });
  });

  describe('markUnreadTerminalAsRead', () => {
    it('stamps only unread terminal items; leaves in-flight and already-read untouched', () => {
      const items = [
        makeItem({ status: ESwapTxHistoryStatus.SUCCESS, created: 1 }),
        makeItem({ status: ESwapTxHistoryStatus.PENDING, created: 2 }),
        makeItem({
          status: ESwapTxHistoryStatus.FAILED,
          created: 3,
          previewReadAt: 777,
        }),
      ];
      const result = markUnreadTerminalAsRead(items, 555);
      expect(result[0].previewReadAt).toBe(555); // success -> stamped
      expect(result[1].previewReadAt).toBeUndefined(); // pending -> untouched
      expect(result[2].previewReadAt).toBe(777); // already read -> untouched
    });
  });
});

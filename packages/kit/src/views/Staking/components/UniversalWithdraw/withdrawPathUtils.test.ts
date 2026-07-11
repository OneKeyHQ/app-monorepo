import {
  clampWithdrawPathIndex,
  resolveSelectedWithdrawPath,
  shouldConfirmNativeInstantWithdrawFee,
  shouldWaitForNativeWithdrawPath,
} from './withdrawPathUtils';

import type { IWithdrawPathBox } from './withdrawPathUtils';

const instantBox: IWithdrawPathBox = {
  title: { text: 'Instant withdrawal' },
  description: { text: '99 USDT' },
  withdrawType: 'instant',
};

const queuedBox: IWithdrawPathBox = {
  title: { text: 'Standard withdrawal' },
  description: { text: '100 USDT' },
  withdrawType: 'queued',
};

function selectedWithdrawTypeFor(
  boxes: IWithdrawPathBox[],
  selectedIndex: number,
  preferredWithdrawType?: IWithdrawPathBox['withdrawType'],
) {
  return resolveSelectedWithdrawPath({
    boxes,
    selectedIndex,
    preferredWithdrawType,
  })?.withdrawType;
}

describe('withdrawPathUtils', () => {
  describe('server returns instant first (current ordering)', () => {
    const boxes = [instantBox, queuedBox];

    it('defaults to instant and requires the fee confirmation', () => {
      const withdrawType = selectedWithdrawTypeFor(boxes, 0);
      expect(withdrawType).toBe('instant');
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType,
        }),
      ).toBe(true);
    });

    it('skips the fee confirmation after switching to queued', () => {
      const withdrawType = selectedWithdrawTypeFor(boxes, 1);
      expect(withdrawType).toBe('queued');
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType,
        }),
      ).toBe(false);
    });
  });

  describe('server returns queued first (future ordering)', () => {
    const boxes = [queuedBox, instantBox];

    it('defaults to queued and skips the fee confirmation', () => {
      const withdrawType = selectedWithdrawTypeFor(boxes, 0);
      expect(withdrawType).toBe('queued');
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType,
        }),
      ).toBe(false);
    });

    it('requires the fee confirmation after switching to instant', () => {
      const withdrawType = selectedWithdrawTypeFor(boxes, 1);
      expect(withdrawType).toBe('instant');
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType,
        }),
      ).toBe(true);
    });
  });

  describe('boxes change between refetches', () => {
    it('falls back to the only remaining box when a stale index overflows', () => {
      // user had instant selected at index 1, refreshed response only has queued
      const withdrawType = selectedWithdrawTypeFor([queuedBox], 1);
      expect(withdrawType).toBe('queued');
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType,
        }),
      ).toBe(false);
    });

    it('still gates a single-box instant-only response', () => {
      const withdrawType = selectedWithdrawTypeFor([instantBox], 0);
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType,
        }),
      ).toBe(true);
    });

    it('preserves the selected path when the server reorders boxes', () => {
      const withdrawType = selectedWithdrawTypeFor(
        [queuedBox, instantBox],
        1,
        'queued',
      );
      expect(withdrawType).toBe('queued');
    });

    it('does not substitute another path when the selected type disappears', () => {
      expect(
        resolveSelectedWithdrawPath({
          boxes: [instantBox],
          selectedIndex: 0,
          preferredWithdrawType: 'queued',
        }),
      ).toBeUndefined();
    });

    it('blocks Native submission when the response has no path', () => {
      expect(resolveSelectedWithdrawPath({ boxes: [], selectedIndex: 0 })).toBe(
        undefined,
      );
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType: undefined,
        }),
      ).toBe(false);
      expect(
        shouldWaitForNativeWithdrawPath({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType: undefined,
          isLoading: false,
        }),
      ).toBe(true);
    });
  });

  describe('clampWithdrawPathIndex', () => {
    it('pins to 0 when there are no or single boxes', () => {
      expect(clampWithdrawPathIndex({ selectedIndex: 3, boxesLength: 0 })).toBe(
        0,
      );
      expect(clampWithdrawPathIndex({ selectedIndex: 3, boxesLength: 1 })).toBe(
        0,
      );
    });

    it('clamps out-of-range indexes into the valid range', () => {
      expect(
        clampWithdrawPathIndex({ selectedIndex: -1, boxesLength: 2 }),
      ).toBe(0);
      expect(clampWithdrawPathIndex({ selectedIndex: 5, boxesLength: 2 })).toBe(
        1,
      );
      expect(clampWithdrawPathIndex({ selectedIndex: 1, boxesLength: 2 })).toBe(
        1,
      );
    });
  });

  describe('shouldConfirmNativeInstantWithdrawFee', () => {
    it('never gates other providers even on instant paths', () => {
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'pendle',
          isCancelWithdrawal: false,
          withdrawType: 'instant',
        }),
      ).toBe(false);
    });

    it('never gates cancel-withdrawal flows', () => {
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'native',
          isCancelWithdrawal: true,
          withdrawType: 'instant',
        }),
      ).toBe(false);
    });

    it('matches the provider name case-insensitively', () => {
      expect(
        shouldConfirmNativeInstantWithdrawFee({
          providerName: 'Native',
          isCancelWithdrawal: false,
          withdrawType: 'instant',
        }),
      ).toBe(true);
    });
  });

  describe('shouldWaitForNativeWithdrawPath', () => {
    it.each(['instant', 'queued'] as const)(
      'allows a resolved %s path when no refresh is pending',
      (withdrawType) => {
        expect(
          shouldWaitForNativeWithdrawPath({
            providerName: 'native',
            isCancelWithdrawal: false,
            withdrawType,
            isLoading: false,
          }),
        ).toBe(false);
      },
    );

    it('blocks while the current Native path is refreshing', () => {
      expect(
        shouldWaitForNativeWithdrawPath({
          providerName: 'native',
          isCancelWithdrawal: false,
          withdrawType: 'instant',
          isLoading: true,
        }),
      ).toBe(true);
    });

    it('does not block other providers or cancellation', () => {
      expect(
        shouldWaitForNativeWithdrawPath({
          providerName: 'pendle',
          isCancelWithdrawal: false,
          withdrawType: undefined,
          isLoading: true,
        }),
      ).toBe(false);
      expect(
        shouldWaitForNativeWithdrawPath({
          providerName: 'native',
          isCancelWithdrawal: true,
          withdrawType: 'cancel',
          isLoading: true,
        }),
      ).toBe(false);
    });
  });
});

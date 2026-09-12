import {
  interpolatePageHeight,
  resolveActiveTabKey,
  resolveDefaultTabKey,
  resolveSettleIndex,
  resolveVisibleTabKeys,
} from './mobileDetailTabs.utils';

describe('mobileDetailTabs.utils', () => {
  describe('resolveVisibleTabKeys', () => {
    it('hides portfolio when there is no position', () => {
      expect(resolveVisibleTabKeys({ hasPortfolio: false })).toEqual([
        'info',
        'protocol',
      ]);
    });

    it('shows portfolio first when there is a position', () => {
      expect(resolveVisibleTabKeys({ hasPortfolio: true })).toEqual([
        'portfolio',
        'info',
        'protocol',
      ]);
    });
  });

  describe('resolveDefaultTabKey', () => {
    it('defaults to info without a position', () => {
      expect(resolveDefaultTabKey({ hasPortfolio: false })).toBe('info');
    });

    it('defaults to portfolio with a position', () => {
      expect(resolveDefaultTabKey({ hasPortfolio: true })).toBe('portfolio');
    });
  });

  describe('resolveActiveTabKey', () => {
    it('keeps the user selection while it stays visible', () => {
      expect(
        resolveActiveTabKey({
          selectedKey: 'protocol',
          visibleKeys: ['portfolio', 'info', 'protocol'],
          defaultKey: 'portfolio',
        }),
      ).toBe('protocol');
    });

    it('falls back to the default when the selection disappears', () => {
      expect(
        resolveActiveTabKey({
          selectedKey: 'portfolio',
          visibleKeys: ['info', 'protocol'],
          defaultKey: 'info',
        }),
      ).toBe('info');
    });

    it('falls back to the first visible tab when the default is hidden too', () => {
      expect(
        resolveActiveTabKey({
          selectedKey: undefined,
          visibleKeys: ['info', 'protocol'],
          defaultKey: 'portfolio',
        }),
      ).toBe('info');
    });

    it('follows the default before the user picks anything', () => {
      expect(
        resolveActiveTabKey({
          selectedKey: undefined,
          visibleKeys: ['portfolio', 'info', 'protocol'],
          defaultKey: 'portfolio',
        }),
      ).toBe('portfolio');
    });
  });

  describe('resolveSettleIndex', () => {
    it('lands on the nearest page after a slow release', () => {
      expect(
        resolveSettleIndex({ progress: 0.4, velocityX: 0, count: 3 }),
      ).toBe(0);
      expect(
        resolveSettleIndex({ progress: 0.6, velocityX: 0, count: 3 }),
      ).toBe(1);
    });

    it('moves one page in the flick direction however short the drag', () => {
      expect(
        resolveSettleIndex({ progress: 0.1, velocityX: -900, count: 3 }),
      ).toBe(1);
      expect(
        resolveSettleIndex({ progress: 1.9, velocityX: 900, count: 3 }),
      ).toBe(1);
    });

    it('never settles past either end', () => {
      expect(
        resolveSettleIndex({ progress: 2.3, velocityX: -900, count: 3 }),
      ).toBe(2);
      expect(
        resolveSettleIndex({ progress: -0.3, velocityX: 900, count: 3 }),
      ).toBe(0);
    });
  });

  describe('interpolatePageHeight', () => {
    it('blends the two neighbouring heights by progress', () => {
      expect(
        interpolatePageHeight({
          progress: 0.25,
          heights: [100, 300, 500],
          fallback: 200,
        }),
      ).toBe(150);
    });

    it('uses the fallback for a page that has not been measured', () => {
      expect(
        interpolatePageHeight({
          progress: 1,
          heights: [100, 0, 500],
          fallback: 200,
        }),
      ).toBe(200);
      expect(
        interpolatePageHeight({ progress: 0, heights: [], fallback: 200 }),
      ).toBe(200);
    });

    it('clamps progress that ran past the ends during overscroll', () => {
      expect(
        interpolatePageHeight({
          progress: 2.4,
          heights: [100, 300, 500],
          fallback: 200,
        }),
      ).toBe(500);
    });
  });
});

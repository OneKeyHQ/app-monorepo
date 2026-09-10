import {
  resolveActiveTabKey,
  resolveDefaultTabKey,
  resolveSwipeTargetKey,
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

  describe('resolveSwipeTargetKey', () => {
    const visibleKeys = ['portfolio', 'info', 'protocol'] as const;
    const base = {
      visibleKeys: [...visibleKeys],
      width: 400,
      velocityX: 0,
    };

    it('moves to the next tab on a long drag to the left', () => {
      expect(
        resolveSwipeTargetKey({
          ...base,
          activeKey: 'portfolio',
          translationX: -120,
        }),
      ).toBe('info');
    });

    it('moves to the previous tab on a long drag to the right', () => {
      expect(
        resolveSwipeTargetKey({
          ...base,
          activeKey: 'protocol',
          translationX: 120,
        }),
      ).toBe('info');
    });

    it('ignores a short, slow drift', () => {
      expect(
        resolveSwipeTargetKey({
          ...base,
          activeKey: 'info',
          translationX: -60,
          velocityX: -200,
        }),
      ).toBeUndefined();
    });

    it('commits a short flick in the drag direction', () => {
      expect(
        resolveSwipeTargetKey({
          ...base,
          activeKey: 'info',
          translationX: -40,
          velocityX: -900,
        }),
      ).toBe('protocol');
    });

    it('treats a flick back against the drag as a change of mind', () => {
      expect(
        resolveSwipeTargetKey({
          ...base,
          activeKey: 'info',
          translationX: -40,
          velocityX: 900,
        }),
      ).toBeUndefined();
    });

    it('does not wrap past either end', () => {
      expect(
        resolveSwipeTargetKey({
          ...base,
          activeKey: 'protocol',
          translationX: -200,
        }),
      ).toBeUndefined();
      expect(
        resolveSwipeTargetKey({
          ...base,
          activeKey: 'portfolio',
          translationX: 200,
        }),
      ).toBeUndefined();
    });

    it('does nothing before the body has a width', () => {
      expect(
        resolveSwipeTargetKey({
          ...base,
          activeKey: 'portfolio',
          translationX: -200,
          width: 0,
        }),
      ).toBeUndefined();
    });
  });
});

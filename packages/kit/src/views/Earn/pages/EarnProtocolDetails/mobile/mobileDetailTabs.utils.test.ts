import {
  resolveActiveTabKey,
  resolveDefaultTabKey,
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
});

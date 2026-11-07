import {
  HOME_PAGER_STICKY_INSET_CSS_VAR,
  buildPortfolioSidebarStickyStyle,
} from './portfolioSidebarSticky';

describe('buildPortfolioSidebarStickyStyle', () => {
  it('sticks below the pager tab bar via the pager CSS variable', () => {
    const style = buildPortfolioSidebarStickyStyle({ scrollerHeight: 0 });
    expect(style.position).toBe('sticky');
    expect(style.top).toBe(
      `calc(var(${HOME_PAGER_STICKY_INSET_CSS_VAR}, 0px) + 8px)`,
    );
    expect(style.maxHeight).toBeUndefined();
    expect(style.overflow).toBeUndefined();
  });

  it('caps the stuck sidebar to the scroller height when known', () => {
    const style = buildPortfolioSidebarStickyStyle({ scrollerHeight: 853 });
    expect(style.maxHeight).toBe(
      `calc(853px - var(${HOME_PAGER_STICKY_INSET_CSS_VAR}, 0px) - 24px)`,
    );
    expect(style.overflow).toBe('auto');
  });

  it('never uses viewport coordinates (no fixed positioning or left offset)', () => {
    const style = buildPortfolioSidebarStickyStyle({ scrollerHeight: 600 });
    expect(style).not.toHaveProperty('left');
    expect(style.position).not.toBe('fixed');
  });
});

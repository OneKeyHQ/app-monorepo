import {
  isOverlayWebContentsId,
  registerOverlayWebContentsId,
} from '../overlayContentsRegistry';

describe('overlayContentsRegistry', () => {
  it('returns false before any id is registered', () => {
    expect(isOverlayWebContentsId(42)).toBe(false);
  });

  it('returns true for a registered id', () => {
    const unregister = registerOverlayWebContentsId(101);
    expect(isOverlayWebContentsId(101)).toBe(true);
    unregister();
  });

  it('returns false after unregister is called', () => {
    const unregister = registerOverlayWebContentsId(202);
    unregister();
    expect(isOverlayWebContentsId(202)).toBe(false);
  });

  it('treats undefined / null as not registered (defensive)', () => {
    expect(isOverlayWebContentsId(undefined)).toBe(false);
    expect(isOverlayWebContentsId(null)).toBe(false);
  });

  it('tracks multiple ids independently', () => {
    const offA = registerOverlayWebContentsId(301);
    const offB = registerOverlayWebContentsId(302);
    expect(isOverlayWebContentsId(301)).toBe(true);
    expect(isOverlayWebContentsId(302)).toBe(true);
    offA();
    expect(isOverlayWebContentsId(301)).toBe(false);
    expect(isOverlayWebContentsId(302)).toBe(true);
    offB();
    expect(isOverlayWebContentsId(302)).toBe(false);
  });
});

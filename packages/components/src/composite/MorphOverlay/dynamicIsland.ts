/**
 * The Dynamic Island's rectangle in the window's own points, derived
 * from the top safe-area inset — no public API exposes the cutout, and
 * the one private UIScreen property that does must not be read by an
 * App Store build. The derivation: the status bar band ends a fixed
 * 11pt under the island, so the island's top is the inset minus its
 * own height plus that air (59 → 11 on the 14 Pro / 15 / 16 class,
 * 62 → 14 on the 16 Pro class). Only an island-class inset qualifies:
 * a notch phone (47), an iPad (24), a portrait-less landscape (0) and
 * every other platform have no island to grow out of.
 */
export const DYNAMIC_ISLAND = {
  width: 126,
  height: 37,
  /** Island height plus the air between it and the status bar's end. */
  belowStatusBar: 48,
  /** The smallest top inset an island phone reports (portrait). */
  minInsetTop: 59,
};

export interface IDynamicIslandRect {
  /** The island's top edge, from the window's top. Horizontally it sits
   * on the window's center, so no `left` is needed. */
  top: number;
  width: number;
  height: number;
  /** A true capsule: half the height. */
  radius: number;
}

export function dynamicIslandRect(
  insetTop: number,
  isNativeIOS: boolean,
): IDynamicIslandRect | undefined {
  if (!isNativeIOS || insetTop < DYNAMIC_ISLAND.minInsetTop) {
    return undefined;
  }
  return {
    top: insetTop - DYNAMIC_ISLAND.belowStatusBar,
    width: DYNAMIC_ISLAND.width,
    height: DYNAMIC_ISLAND.height,
    radius: DYNAMIC_ISLAND.height / 2,
  };
}

import { createContext, useContext } from 'react';
import type { ReactElement, ReactNode } from 'react';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

// NOTE: import useSafeAreaInsets from the leaf package directly, not from the
// '../../hooks' barrel — that barrel transitively re-exports the Provider that
// imports this file, forming an import cycle.

/**
 * Signals that the current subtree is rendered inside an iOS 26 Liquid
 * Glass navigation bar — i.e. UIKit has wrapped this header view in a
 * system glass `UIBarButtonItem` capsule that already provides its own
 * container shape and press/hover feedback.
 *
 * Header buttons (e.g. `IconButton`) read this to drop their self-drawn
 * background/press styles and raise icon contrast, so they don't double
 * up on the system glass.
 *
 * IMPORTANT: this is only ever `true` on iOS 26+, AND only for views that
 * are actually injected into the native glass bar (via the classic
 * `headerLeft`/`headerRight` render path). It stays `false` for in-page
 * headers that merely live on an iOS 26 device — e.g. the Home tab header,
 * which renders its buttons in a normal in-page `XStack`, not the nav bar.
 * That is exactly why consumers must gate on this context rather than on
 * `platformEnv.isNativeIOS26Plus` directly (the latter over-reaches to
 * non-glass surfaces).
 */
const GlassHeaderContext = createContext<boolean>(false);

export function useInGlassHeader(): boolean {
  return useContext(GlassHeaderContext);
}

// The frame-style reset a header button applies once it detects (via
// `useInGlassHeader`) that it sits inside the iOS 26 system glass capsule. The
// capsule already owns the container shape and the press/hover feedback, so we
// strip our self-drawn background/border/press styles and the tertiary negative
// margin to avoid doubling up on the glass. Shared by Button and IconButton so
// the two stay byte-for-byte identical.
export const GLASS_HEADER_BAREIFY_RESET = {
  m: 0,
  bg: '$transparent',
  borderColor: '$transparent',
  hoverStyle: undefined,
  pressStyle: undefined,
  focusVisibleStyle: undefined,
} as const;

// The iOS 26 Liquid Glass nav bar is transparent (headerTransparent), so screen
// content renders *under* it for the glass to refract it. The standard iOS
// inline nav bar is 44pt tall below the safe-area top; the extra gap keeps
// content from butting right up against the glass edge.
export const LIQUID_GLASS_HEADER_BAR_HEIGHT = 44;
export const LIQUID_GLASS_HEADER_CONTENT_GAP = 16;

// Single source of truth for the top inset a screen must reserve when its
// content extends under the iOS 26 Liquid Glass nav bar (safe-area top + bar
// height + a breathing gap). Returns 0 off iOS 26, where the bar is opaque /
// self-drawn and the screen keeps its normal layout. Centralizing this keeps
// every glass screen's top spacing consistent and adjustable in one place.
export function useLiquidGlassHeaderTopInset(): number {
  const { top } = useSafeAreaInsets();
  if (!platformEnv.isNativeIOS26Plus) {
    return 0;
  }
  return top + LIQUID_GLASS_HEADER_BAR_HEIGHT + LIQUID_GLASS_HEADER_CONTENT_GAP;
}

export function GlassHeaderProvider({ children }: { children: ReactNode }) {
  return (
    <GlassHeaderContext.Provider value>{children}</GlassHeaderContext.Provider>
  );
}

// Bridge to the patched @react-navigation/native-stack `useHeaderConfigProps`,
// which on iOS 26 reads `globalThis.$onekeyGlassHeaderUIStyle` to drive the
// nav bar's `userInterfaceStyle` (light/dark glass variant) from OneKey's own
// app theme. react-navigation's theme resolves a frame late on each
// navigation, so the Liquid Glass bar otherwise renders its light variant
// first and only corrects to dark on a later re-render. A global is used
// because the patched library file cannot import app modules. ConfigProvider —
// an ancestor of every header, themed correctly on the very first frame —
// writes it on iOS 26 only; elsewhere it stays unset and native-stack keeps
// its default behavior.
export function setGlassHeaderUIStyle(name: 'light' | 'dark' | undefined) {
  (
    globalThis as { $onekeyGlassHeaderUIStyle?: 'light' | 'dark' }
  ).$onekeyGlassHeaderUIStyle = name;
}

type IHeaderRenderFn = (props: any) => ReactNode;

type IGlassHeaderItem = {
  type: 'custom';
  element: ReactElement;
  hidesSharedBackground?: boolean;
};
type IHeaderItemsFn = (props: any) => IGlassHeaderItem[];

// A custom native bar item whose React element is rendered inside the system
// glass capsule, stripped via GlassHeaderProvider (so the inner IconButton
// drops its own background/press instead of doubling up on the glass). Use this
// for every `unstable_*Items` custom item that wants a OneKey glyph in glass —
// it keeps the provider-wrap (the load-bearing detail) in one place so call
// sites can't forget it.
export function glassBarItem(element: ReactElement): IGlassHeaderItem {
  return {
    type: 'custom',
    element: <GlassHeaderProvider>{element}</GlassHeaderProvider>,
  };
}

function isEmptyRender(rendered: ReactNode): boolean {
  // react-native-screens only emits a header bar button — and thus a glass
  // capsule — when the rendered element is non-null. Preserving these falsy
  // results avoids drawing a hollow glass capsule for conditionally-hidden
  // header buttons.
  return rendered === null || rendered === undefined || rendered === false;
}

// Memoizes a transform of a header render fn, keyed by the source fn, so the
// result is referentially stable across renders — PageHeader relies on stable
// option refs to avoid a setOptions → re-render → setOptions loop. Returns
// `undefined` off iOS 26 (and for non-functions) so callers fall back to the
// classic, non-glass header path — the only one that renders on Android /
// iOS < 26.
function memoHeaderTransform<R>(
  cache: WeakMap<IHeaderRenderFn, R>,
  renderFn: unknown,
  build: (source: IHeaderRenderFn) => R,
): R | undefined {
  if (!platformEnv.isNativeIOS26Plus || typeof renderFn !== 'function') {
    return undefined;
  }
  const source = renderFn as IHeaderRenderFn;
  const cached = cache.get(source);
  if (cached) {
    return cached;
  }
  const built = build(source);
  cache.set(source, built);
  return built;
}

const wrapCache = new WeakMap<IHeaderRenderFn, IHeaderRenderFn>();

// Wraps a classic header render fn so its output renders inside the
// GlassHeaderProvider, letting descendant buttons detect they're in the iOS 26
// glass bar. Identity off iOS 26.
export function wrapHeaderRenderInGlass<T>(renderFn: T): T {
  const wrapped = memoHeaderTransform<IHeaderRenderFn>(
    wrapCache,
    renderFn,
    // The built value is a header render fn (fed to setOptions), not a rendered
    // component, so it needs no display name.
    // eslint-disable-next-line react/display-name
    (source) => (props) => {
      const rendered = source(props);
      return isEmptyRender(rendered) ? (
        rendered
      ) : (
        <GlassHeaderProvider>{rendered}</GlassHeaderProvider>
      );
    },
  );
  return (wrapped ?? renderFn) as T;
}

const noGlassCache = new WeakMap<IHeaderRenderFn, IHeaderItemsFn>();

// Converts a classic header render fn into an `unstable_*Items` function whose
// single custom item carries `hidesSharedBackground: true`, so iOS 26 does NOT
// wrap it in a system glass capsule. Used (via PageHeader) for header content
// that isn't a single icon button — e.g. a text Button — where the glass pill
// looks wrong (extra width + the button's own press style showing through).
// Returns undefined off iOS 26 so callers keep the classic `headerLeft/Right`
// path — the custom-items path only renders inside `Platform.OS === 'ios'`.
export function toNoGlassHeaderItems<T>(
  renderFn: T,
): IHeaderItemsFn | undefined {
  return memoHeaderTransform<IHeaderItemsFn>(
    noGlassCache,
    renderFn,
    (source) => (props) => {
      const rendered = source(props);
      return isEmptyRender(rendered)
        ? []
        : [
            {
              type: 'custom',
              element: <>{rendered}</>,
              hidesSharedBackground: true,
            },
          ];
    },
  );
}

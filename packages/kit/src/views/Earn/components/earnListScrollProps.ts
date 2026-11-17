import platformEnv from '@onekeyhq/shared/src/platformEnv';

// FlashList v2 enables maintainVisibleContentPosition by default. On the earn
// full-list pages the initial render can be in a provisional order (e.g. the
// Tokens page renders before the TVL aggregation resolves, with all sort
// values at 0); when the real sort values arrive the list fully reorders and
// mVCP re-anchors the scroll offset to the previously visible row's new
// position — the list visually jumps with the header scrolled off-screen.
// Disabling it also keeps user-initiated sort changes rendering from the top
// (same rationale as the Perp token selector, OK-54946 / OK-57864).
// Typed as a loose record and spread conditionally: the web ListView is a
// FlatList whose maintainVisibleContentPosition prop has a different shape.
export const earnListScrollBehaviorProps: Record<string, unknown> =
  platformEnv.isNativeAndroid || platformEnv.isNativeIOS
    ? {
        maintainVisibleContentPosition: {
          disabled: true,
        },
      }
    : {};

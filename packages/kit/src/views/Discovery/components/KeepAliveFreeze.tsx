import type { PropsWithChildren } from 'react';

import { StyleSheet, View } from 'react-native';

import type { StyleProp, ViewStyle } from 'react-native';

// A freeze primitive that keeps its subtree mounted AND its native views
// attached, unlike `react-freeze`.
//
// `react-freeze` freezes by suspending the subtree to a `null` Suspense
// fallback. On iOS RN that detaches the subtree's native views from their
// parent view; a `WKWebView` inside then reloads its URL when it is later
// re-attached (unfreeze / tab switch / minimize→reopen). Confirmed via
// lifecycle logs: with `<Freeze>` every reactivation fired `onLoadStart` with
// NO mount/unmount — i.e. the native WebView reloaded purely from the detach.
// See docs/discovery-browser-webpage-tabs-reload.md.
//
// This component instead keeps the view mounted AND attached the whole time and
// only hides it visually when `freeze` is true: `opacity: 0` +
// `pointerEvents: 'none'`, de-prioritized in the z-order. Hosts are absolutely
// filled so sibling frozen/active layers overlap (the active one is drawn on
// top) instead of stacking in a column.
//
// Note: this intentionally does NOT stop the subtree from re-rendering (that is
// react-freeze's separate performance goal). Keeping the WebView alive is what
// fixes the reload; a browser tab's re-render cost while hidden is negligible.
const styles = StyleSheet.create({
  base: {
    ...StyleSheet.absoluteFillObject,
  },
  active: {
    opacity: 1,
    zIndex: 1,
  },
  frozen: {
    opacity: 0,
    zIndex: 0,
  },
});

export function KeepAliveFreeze({
  freeze,
  style,
  children,
}: PropsWithChildren<{
  freeze: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  return (
    <View
      // collapsable={false} keeps this a real native view under Fabric view
      // flattening — a flattened wrapper would break the "stays attached"
      // invariant this component exists to guarantee.
      collapsable={false}
      pointerEvents={freeze ? 'none' : 'auto'}
      // A frozen (opacity:0) subtree is still in the accessibility tree, so
      // hide it from VoiceOver/TalkBack too, otherwise a screen reader can
      // focus invisible off-screen web content.
      accessibilityElementsHidden={freeze}
      importantForAccessibility={freeze ? 'no-hide-descendants' : 'auto'}
      style={[styles.base, freeze ? styles.frozen : styles.active, style]}
    >
      {children}
    </View>
  );
}

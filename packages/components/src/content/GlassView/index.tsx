import type { PropsWithChildren } from 'react';

import { View } from 'react-native';
import Animated from 'react-native-reanimated';

import type { StyleProp, ViewStyle } from 'react-native';

export type IGlassViewProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  glassEffectStyle?: 'clear' | 'regular' | 'none';
  tintColor?: string;
  isInteractive?: boolean;
}>;

// Liquid Glass only exists on iOS 26+. This non-iOS placeholder is never
// rendered (every caller gates on isLiquidGlassAvailable(), which is false
// here) — it exists only so cross-platform code can import GlassView without
// pulling in the iOS-only expo-glass-effect native module. The `.ios.tsx`
// variant is the only place expo-glass-effect is referenced.
export function GlassView({ children, style }: IGlassViewProps) {
  return <View style={style}>{children}</View>;
}

// Placeholder too (see index.ios.tsx); never rendered off iOS.
export const AnimatedGlassView = Animated.createAnimatedComponent(GlassView);

export function isLiquidGlassAvailable(): boolean {
  return false;
}

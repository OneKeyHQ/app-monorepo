// iOS only: wraps the real expo-glass-effect primitives. This is the single
// file that references the iOS-only native module; every other platform resolves
// the passthrough in index.tsx, so expo-glass-effect never enters a non-iOS
// bundle. Callers must gate rendering on isLiquidGlassAvailable() (true only on
// iOS 26+ with the Liquid Glass material).
import { GlassView as ExpoGlassView } from 'expo-glass-effect';

import { useThemeName } from '../../hooks/useStyle';

import type { GlassViewProps } from 'expo-glass-effect';

export { isLiquidGlassAvailable } from 'expo-glass-effect';

// With the default 'auto' scheme the glass picks its light/dark variant from
// the content behind it, and every time the view is shown again (a tab switch,
// or the iPad split-view main pane returning after full-screen onboarding) it
// starts from the dark variant and fades to light ~0.5 s later. The glass hosts
// theme-colored content, so pin it to the app theme like BlurView's tint.
export function GlassView({ colorScheme, ...props }: GlassViewProps) {
  const themeName = useThemeName();
  return (
    <ExpoGlassView
      colorScheme={colorScheme ?? (themeName === 'dark' ? 'dark' : 'light')}
      {...props}
    />
  );
}

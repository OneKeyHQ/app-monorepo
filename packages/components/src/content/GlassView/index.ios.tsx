// iOS only: re-export the real expo-glass-effect primitives. This is the single
// file that references the iOS-only native module; every other platform resolves
// the passthrough in index.tsx, so expo-glass-effect never enters a non-iOS
// bundle. Callers must gate rendering on isLiquidGlassAvailable() (true only on
// iOS 26+ with the Liquid Glass material).
export { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

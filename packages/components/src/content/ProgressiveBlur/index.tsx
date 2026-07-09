// Non-iOS placeholder. The progressive Liquid Glass / blur header is iOS-only
// (it relies on the iOS-only masked-view stack). Every caller gates rendering on
// platformEnv.isNativeIOS, so this is never rendered; it exists only so
// cross-platform code can import ProgressiveBlur without pulling the native-only
// modules into other platform bundles. The `.ios.tsx` variant is the only place
// those modules are referenced.
export function ProgressiveBlur() {
  return null;
}

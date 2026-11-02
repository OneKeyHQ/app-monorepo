// The Headless SDK is native-iOS-only. Web/desktop always report unsupported so
// the branch helper routes to the existing web widget.
export function canUseHeadless(): boolean {
  return false;
}

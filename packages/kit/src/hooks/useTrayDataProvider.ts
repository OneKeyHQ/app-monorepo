/**
 * No-op stub for non-desktop platforms.
 * The actual implementation lives in useTrayDataProvider.desktop.ts
 * and is loaded only on desktop builds via platform-specific resolution.
 */
export function useTrayDataProvider(): void {
  // No-op on non-desktop platforms
}

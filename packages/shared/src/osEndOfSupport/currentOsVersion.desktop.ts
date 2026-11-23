// Filled by the preload script from process.getSystemVersion().
export function getCurrentOsVersion(): string | undefined {
  return globalThis.desktopApi?.systemVersion || undefined;
}

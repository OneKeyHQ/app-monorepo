// onekey: upstream read `process.env.SDK_DEBUG` and friends inline in
// `utils/logging.ts`. `process` does not exist in the extension, native or
// web-embed bundles, and upstream's own browser build replaced those reads with
// `undefined` (sdk/scripts/build-browser.ts). Flags now live here, default to
// off, and are set explicitly by the host when debugging.

/** Names upstream read from `process.env`. */
export type SdkDebugFlagName =
  | 'SDK_DEBUG'
  | 'SDK_DEBUG_COLOR'
  | 'NO_COLOR'
  | 'FORCE_COLOR';

const flags = new Map<SdkDebugFlagName, string>();

/**
 * Read a debug flag. Returns `undefined` (off) unless the host set it.
 */
export function getSdkDebugFlag(name: SdkDebugFlagName): string | undefined {
  return flags.get(name);
}

/**
 * Enable or clear a debug flag at runtime.
 *
 * `SDK_DEBUG` accepts `"1"`, `"true"`, or a comma-separated list of
 * target/method prefixes (for example `"IndexerDiscovery,ProvingService.prove"`).
 */
export function setSdkDebugFlag(
  name: SdkDebugFlagName,
  value: string | undefined,
): void {
  if (value === undefined) {
    flags.delete(name);
    return;
  }
  flags.set(name, value);
}

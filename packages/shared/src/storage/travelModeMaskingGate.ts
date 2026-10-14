/**
 * Is this launch masking data?
 *
 * Storage modules ask this to decide whether a cache may exist at all, so it
 * has to answer without awaiting anything and without importing Travel Mode at
 * module scope — Travel Mode's own control record lives in storage, and an
 * eager import closes that circle.
 *
 * Two properties the callers rely on:
 *
 * - Unreachable counts as masked. A failure costs a cache, never the
 *   guarantee.
 * - The answer is fixed for the life of the runtime. A Travel Mode transition
 *   ends in `transition-recovery` and both runtimes restart before the new
 *   profile applies, so a caller may read this once while building a store.
 */
let travelModeMaskingRef: { isMaskingDataSync: () => boolean } | undefined;

export function isTravelModeMaskingSync(): boolean {
  try {
    if (!travelModeMaskingRef) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      travelModeMaskingRef = (
        require('../travelMode') as typeof import('../travelMode')
      ).travelModeManager;
    }
    return travelModeMaskingRef?.isMaskingDataSync() ?? true;
  } catch {
    return true;
  }
}

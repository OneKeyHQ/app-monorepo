// Default (web / desktop / extension) variant.
//
// These platforms do not have the iOS jetsam cold-start-lock kill problem that
// `IS_LOW_END_DEVICE` guards against, so the constant is always `false` here and
// any low-end-only behavior is a no-op. See ./lowEndDevice.native.ts for the
// native (RAM-tiered) computation.
export const IS_LOW_END_DEVICE = false;

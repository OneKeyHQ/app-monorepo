// Kept out of the keys entity so callers do not load the entity eagerly.
// Tagged property, so callers need not match on message text.
export const PRIVACY_CHAIN_VIEWING_KEY_MISMATCH =
  'privacyChainViewingKeyMismatch';

export function isPrivacyChainViewingKeyMismatchError(e: unknown): boolean {
  return (
    !!e &&
    typeof e === 'object' &&
    (e as Record<string, unknown>)[PRIVACY_CHAIN_VIEWING_KEY_MISMATCH] === true
  );
}

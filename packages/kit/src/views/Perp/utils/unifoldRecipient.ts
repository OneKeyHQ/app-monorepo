// cspell: words unifold Unifold
const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

// Fail-closed guard: the Unifold recipient MUST be the currently active Perps
// account address at the moment the SDK is mounted. Any mismatch aborts the
// deposit instead of falling back to a possibly-stale value, so a swapped or
// empty address can never reach the vendor SDK.
export function getSafeUnifoldRecipient({
  recipient,
  activeAccountAddress,
}: {
  recipient: string | undefined;
  activeAccountAddress: string | undefined;
}): string | null {
  if (!recipient || !activeAccountAddress) {
    return null;
  }
  if (!EVM_ADDRESS_RE.test(recipient)) {
    return null;
  }
  if (recipient.toLowerCase() !== activeAccountAddress.toLowerCase()) {
    return null;
  }
  return recipient;
}

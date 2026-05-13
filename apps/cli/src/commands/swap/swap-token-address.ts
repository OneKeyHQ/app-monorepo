const SOL_NETWORK_ID = 'sol--101';
const SOL_NATIVE_ADDRESS_ALIASES = new Set([
  '',
  '11111111111111111111111111111111',
  'So11111111111111111111111111111111111111112',
]);

export function tokenAddressMatchesForNetwork(
  networkId: string,
  actual: string,
  expected: string,
): boolean {
  if (networkId === SOL_NETWORK_ID) {
    if (
      SOL_NATIVE_ADDRESS_ALIASES.has(actual) &&
      SOL_NATIVE_ADDRESS_ALIASES.has(expected)
    ) {
      return true;
    }
    return actual === expected;
  }

  return actual.toLowerCase() === expected.toLowerCase();
}

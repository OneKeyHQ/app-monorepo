const EMPTY_TOKEN_KEYS = new Set<string>();

export function useSwapProTokenCarryOptions(_options: { enabled: boolean }) {
  return {
    proSupportedNetworkIds: EMPTY_TOKEN_KEYS,
    stableTokenKeys: EMPTY_TOKEN_KEYS,
    tokenCarryUtils: undefined,
  };
}

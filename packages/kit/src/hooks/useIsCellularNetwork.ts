// Only the native counterpart checks the connection (via NetInfo); other platforms expose no reliable state.
export function useIsCellularNetwork(): boolean {
  return false;
}

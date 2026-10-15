// Desktop, extension and web expose no reliable metered-connection state
// (navigator.connection is absent or inaccurate on most of them), so only the
// native counterpart checks the connection through NetInfo.
export function useIsCellularNetwork(): boolean {
  return false;
}

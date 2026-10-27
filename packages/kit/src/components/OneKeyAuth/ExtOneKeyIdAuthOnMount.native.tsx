// The OneKey ID auth hand-off only runs in the extension expand tab. Native
// renders nothing, which also keeps the free-trial pending action and its
// access gate out of the native startup bundle.
export function ExtOneKeyIdAuthOnMount() {
  return null;
}

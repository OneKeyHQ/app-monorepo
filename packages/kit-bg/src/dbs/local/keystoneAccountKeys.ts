/** Keeps every pinned key; new entries are added only when no pinned entry differs. */
export function mergeKeystoneAccountKeys(
  pinned: Record<string, string>,
  keys: Record<string, string>,
): { merged: Record<string, string>; mismatched: string[] } {
  const mismatched = Object.keys(keys).filter(
    (entry) => pinned[entry] !== undefined && pinned[entry] !== keys[entry],
  );
  return {
    merged: mismatched.length ? pinned : { ...keys, ...pinned },
    mismatched,
  };
}

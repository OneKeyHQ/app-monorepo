// Chromium rejects reads with this message when a value's external blob file
// is corrupted (e.g. crash mid-write); the record then stays unreadable
// forever. Shared by all SimpleDB self-heal opt-ins (perp / localTokens /
// localHistory). Keep UnknownError + message includes — NotReadableError and
// UnknownError without this fragment cover transient IO where deleting would
// lose recoverable data (OK-59997 / OK-61648).
export const UNREADABLE_INDEXED_DB_VALUE_MESSAGE =
  'Failed to read large IndexedDB value';

export function isUnreadableStorageValueError(error: unknown): boolean {
  const { name, message } = (error ?? {}) as {
    name?: string;
    message?: string;
  };
  return (
    name === 'UnknownError' &&
    Boolean(message?.includes(UNREADABLE_INDEXED_DB_VALUE_MESSAGE))
  );
}

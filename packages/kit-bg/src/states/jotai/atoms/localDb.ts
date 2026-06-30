import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

// Carries the original message of a local-database open failure (Realm /
// IndexedDB). It is written from the background DB layer when `_openDb()`
// throws, and read by the lock screen so the message is surfaced under the
// password input immediately on mount — instead of only after a verify attempt
// fails. `errorMessage` is undefined when the DB opened normally.
//
// Not persisted: it must reflect ONLY the current process's DB-open outcome (a
// stale persisted failure from a previous launch must never block a healthy
// start). The atom lives in the jotai global store (MMKV / IndexedDB-backed,
// independent of the business Realm/IndexedDB), so it still works when the
// business DB itself failed to open. (OK-56874)
export type ILocalDbOpenErrorAtom = {
  errorMessage: string | undefined;
};
export const { target: localDbOpenErrorAtom, use: useLocalDbOpenErrorAtom } =
  globalAtom<ILocalDbOpenErrorAtom>({
    persist: false,
    name: EAtomNames.localDbOpenErrorAtom,
    initialValue: {
      errorMessage: undefined,
    },
  });

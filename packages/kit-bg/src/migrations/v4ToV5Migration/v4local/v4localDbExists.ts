import { V4_INDEXED_DB_NAME } from './v4localDBConsts';

export default async function v4localDbExists(): Promise<boolean> {
  try {
    const { indexedDB } = globalThis;
    const databases = await indexedDB.databases();
    if (!databases.some((db) => db.name === V4_INDEXED_DB_NAME)) return false;

    // Reset leaves an empty schema when another context still has a handle.
    // Only a database with records can be a source for V4 migration.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open(V4_INDEXED_DB_NAME);
      open.onupgradeneeded = () => open.transaction?.abort();
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    try {
      const names = Array.from(db.objectStoreNames);
      if (!names.length) return false;
      const tx = db.transaction(names, 'readonly');
      const hasRecords = await Promise.all(
        names.map(
          (name) =>
            new Promise<boolean>((resolve, reject) => {
              const req = tx.objectStore(name).openKeyCursor();
              req.onsuccess = () => resolve(req.result !== null);
              req.onerror = () => reject(req.error);
            }),
        ),
      );
      return hasRecords.some(Boolean);
    } finally {
      db.close();
    }
  } catch (_error) {
    return false;
  }
}

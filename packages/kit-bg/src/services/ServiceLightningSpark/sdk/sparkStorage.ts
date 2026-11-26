// Breez keeps a wallet's state in IndexedDB on web, desktop and the
// extension: one database per wallet identity, named
// `<storageDir>/<network>/<identity hash>`, and the same name with `-tree` for
// its tree store.

function deleteDatabase(indexedDB: IDBFactory, name: string) {
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    // A connection in another tab holds the database; the browser deletes it
    // once that connection closes.
    request.onblocked = () => resolve();
  });
}

/** Deletes the databases of every storage directory that `match` accepts. */
export async function removeSparkStorage(
  match: (storageDir: string) => boolean,
): Promise<void> {
  const { indexedDB } = globalThis;
  // Without a database list (Firefox before 126) the names are unknown.
  if (!indexedDB?.databases) {
    return;
  }
  const databases = await indexedDB.databases();
  for (const { name } of databases) {
    if (name && match(name.split('/')[0])) {
      await deleteDatabase(indexedDB, name);
    }
  }
}

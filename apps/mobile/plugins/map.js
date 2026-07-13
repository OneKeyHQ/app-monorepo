const innerMap = new Map(); // path → id
const usedIds = new Set(); // track assigned IDs to prevent collisions

let nextId = 0;

const fileToIdMap = {
  has: (path) => innerMap.has(path),
  safeSet: (path) => {
    do {
      nextId += 1;
    } while (usedIds.has(nextId));
    innerMap.set(path, nextId);
    usedIds.add(nextId);
    return nextId;
  },
  set: (path, id) => {
    innerMap.set(path, id);
    usedIds.add(id);
  },
  get: (path) => {
    if (innerMap.has(path)) {
      return innerMap.get(path);
    }
    return fileToIdMap.safeSet(path);
  },
  delete: (path) => {
    const id = innerMap.get(path);
    innerMap.delete(path);
    if (id !== undefined) usedIds.delete(id);
  },
  // Exposed for the startup-profile prologue builder so it can emit a
  // complete moduleId → path map. Returns the underlying Map's iterator so
  // consumers can iterate without snapshotting.
  entries: () => innerMap.entries(),
  size: () => innerMap.size,
};
exports.fileToIdMap = fileToIdMap;

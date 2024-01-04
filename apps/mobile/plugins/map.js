const innerMap = new Map();

let nextId = 0;

const fileToIdMap = {
  has: (path) => innerMap.has(path),
  safeSet: (path) => {
    do {
      nextId += 1;
    } while (innerMap.has(nextId));
    innerMap.set(path, nextId);
    return nextId;
  },
  set: (path, id) => {
    innerMap.set(path, id);
  },
  get: (path) => {
    if (innerMap.has(path)) {
      return innerMap.get(path);
    }
    return fileToIdMap.safeSet(path);
  },
  delete: (path) => {
    innerMap.delete(path);
  },
};
exports.fileToIdMap = fileToIdMap;

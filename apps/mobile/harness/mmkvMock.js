// In-memory mock for react-native-mmkv used during harness tests.
// MMKV's createMMKV() calls JSI synchronously; after an app restart
// the JSI bridge may not be ready, causing a permanent hang.
// Tests that use storage mock appStorage anyway, so this is safe.

function makeMemoryMMKV() {
  const store = new Map();
  return {
    set(key, value) {
      store.set(key, String(value));
    },
    getString(key) {
      return store.get(key);
    },
    getNumber(key) {
      const v = store.get(key);
      return v !== undefined ? Number(v) : undefined;
    },
    getBoolean(key) {
      const v = store.get(key);
      return v !== undefined ? v === 'true' : undefined;
    },
    delete(key) {
      store.delete(key);
    },
    remove(key) {
      store.delete(key);
    },
    getAllKeys() {
      return [...store.keys()];
    },
    clearAll() {
      store.clear();
    },
    contains(key) {
      return store.has(key);
    },
    addOnValueChangedListener() {
      return { remove() {} };
    },
  };
}

module.exports = {
  createMMKV: makeMemoryMMKV,
  MMKV: makeMemoryMMKV,
};

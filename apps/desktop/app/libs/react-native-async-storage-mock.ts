// In-memory storage for desktop environment
const storage = new Map<string, string>();

export const AsyncStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return storage.get(key) || null;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    storage.set(key, value);
  },

  removeItem: async (key: string): Promise<void> => {
    storage.delete(key);
  },

  clear: async (): Promise<void> => {
    storage.clear();
  },

  getAllKeys: async (): Promise<string[]> => {
    return Array.from(storage.keys());
  },

  multiGet: async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map((key) => [key, storage.get(key) || null]);
  },

  multiSet: async (keyValuePairs: [string, string][]): Promise<void> => {
    keyValuePairs.forEach(([key, value]) => {
      storage.set(key, value);
    });
  },

  multiRemove: async (keys: string[]): Promise<void> => {
    keys.forEach((key) => {
      storage.delete(key);
    });
  },

  mergeItem: async (key: string, value: string): Promise<void> => {
    const existingValue = storage.get(key);
    if (existingValue) {
      try {
        const existingObject = JSON.parse(existingValue);
        const newObject = JSON.parse(value);
        const mergedObject = { ...existingObject, ...newObject };
        storage.set(key, JSON.stringify(mergedObject));
      } catch {
        storage.set(key, value);
      }
    } else {
      storage.set(key, value);
    }
  },

  multiMerge: async (keyValuePairs: [string, string][]): Promise<void> => {
    for (const [key, value] of keyValuePairs) {
      await AsyncStorage.mergeItem(key, value);
    }
  },
};

export default AsyncStorage;

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export function createPrintMethod({
  storage,
}: {
  storage: AsyncStorageStatic;
}) {
  return async () => {
    const keys = await storage.getAllKeys();
    for (const key of keys) {
      const item = await storage.getItem(key);
      let itemJson = item;
      try {
        itemJson = JSON.parse(item as string);
      } catch (error) {
        // noop
      } finally {
        // noop
      }
      console.log(key, '\r\n\t\t', itemJson);
    }
  };
}

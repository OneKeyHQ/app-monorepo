export function createUntrackedMemoryStorage(initial: unknown) {
  let value = initial;
  return {
    get value() {
      return value;
    },
    getItem: async () => value,
    setItem: async (_key: string, next: unknown) => {
      value = next;
    },
    removeItem: async () => {
      value = null;
    },
  };
}

export function createMemoryStorage(initial: unknown) {
  const storage = createUntrackedMemoryStorage(initial);
  return {
    get value() {
      return storage.value;
    },
    getItem: jest.fn(storage.getItem),
    setItem: jest.fn(storage.setItem),
    removeItem: jest.fn(storage.removeItem),
  };
}

export function withMemoryStorage<T extends object>(
  entity: T,
  initial: unknown = null,
): T {
  Reflect.set(entity, 'appStorage', createMemoryStorage(initial));
  return entity;
}

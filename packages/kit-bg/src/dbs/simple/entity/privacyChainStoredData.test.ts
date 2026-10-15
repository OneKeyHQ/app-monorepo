import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { SimpleDbEntityXmr } from './SimpleDbEntityXmr';
import { SimpleDbEntityZcash } from './SimpleDbEntityZcash';

describe.each([
  { name: 'zcash', create: () => new SimpleDbEntityZcash() },
  { name: 'xmr', create: () => new SimpleDbEntityXmr() },
])('$name critical persisted data', ({ name, create }) => {
  it.each([
    '{"private-fragment":',
    'null',
    '42',
    '[]',
    '{"data":null,"updatedAt":1}',
    '{"data":{"accounts":[]},"updatedAt":1}',
    '{"data":{"accounts":{"account":{"intent":"invalid"}}},"updatedAt":1}',
  ])('preserves malformed data and refuses a builder write', async (saved) => {
    const entity = create();
    const getItem = jest.fn(async () => saved);
    const setItem = jest.fn();
    const removeItem = jest.fn();
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    Reflect.set(entity, 'appStorage', { getItem, setItem, removeItem });
    const builder = jest.fn(() => ({ accounts: {} }));
    try {
      await expect(entity.getRawData()).rejects.toThrow(
        `simpledb: invalid persisted data (${name})`,
      );
      await expect(entity.setRawData(builder)).rejects.toThrow(
        `simpledb: invalid persisted data (${name})`,
      );
      expect(builder).not.toHaveBeenCalled();
      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('retains the record when the storage backend cannot read its blob', async () => {
    const entity = create();
    const error = new Error('Failed to read large IndexedDB value');
    error.name = 'UnknownError';
    const getItem = jest.fn(async () => {
      throw error;
    });
    const removeItem = jest.fn();
    Reflect.set(entity, 'appStorage', { getItem, removeItem });
    await expect(entity.getRawData()).rejects.toBe(error);
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('retains unknown future fields during a valid update', async () => {
    const original = { accounts: {}, futureField: { value: 'retained' } };
    let saved: unknown = { data: original, updatedAt: 1 };
    const entity = create();
    Reflect.set(entity, 'appStorage', {
      getItem: async () => saved,
      setItem: async (_key: string, value: unknown) => {
        saved = value;
      },
    });
    await entity.setRawData((data: unknown) => {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new OneKeyLocalError('Expected the existing data object');
      }
      return { ...data, accounts: {} };
    });
    await expect(entity.getRawData()).resolves.toEqual(original);
  });
});

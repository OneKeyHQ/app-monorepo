import {
  readExtensionTokenPreview,
  storeExtensionTokenPreview,
} from './marketTokenPreviewRoute';

const identity = { network: 'eth', tokenAddress: '0xabc', isNative: false };
const preview = {
  address: '0xabc',
  networkId: 'evm--1',
  name: 'ABC',
  symbol: 'ABC',
  decimals: 18,
  selectedAt: 1,
};
const originalChrome = globalThis.chrome;
let records: Record<string, unknown>;

beforeEach(() => {
  records = {};
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: {
      runtime: { id: 'trusted-extension' },
      storage: {
        session: {
          get: jest.fn(async (key: string | null) =>
            key ? { [key]: records[key] } : { ...records },
          ),
          set: jest.fn(async (entries: Record<string, unknown>) => {
            Object.assign(records, entries);
          }),
          remove: jest.fn(async (keys: string[]) => {
            keys.forEach((key) => {
              delete records[key];
            });
          }),
        },
      },
    },
  });
});
afterEach(() => {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: originalChrome,
  });
  jest.restoreAllMocks();
});

it('transfers trusted metadata by handle without placing metadata in the handle', async () => {
  const id = await storeExtensionTokenPreview(identity, preview);
  expect(id).toMatch(/^[a-f0-9-]{36}$/);
  expect(await readExtensionTokenPreview(id!, identity)).toEqual(preview);
});

it('rejects an unknown handle and identity changes', async () => {
  const id = await storeExtensionTokenPreview(identity, preview);
  expect(
    await readExtensionTokenPreview(
      '00000000-0000-4000-8000-000000000000',
      identity,
    ),
  ).toBeUndefined();
  for (const changed of [
    { network: 'sol' },
    { tokenAddress: 'scam' },
    { isNative: true },
  ]) {
    expect(
      await readExtensionTokenPreview(id!, { ...identity, ...changed }),
    ).toBeUndefined();
  }
});

it('expires old handles and bounds retained entries without removing other session keys', async () => {
  records.unrelated = 'preserve';
  const now = jest.spyOn(Date, 'now').mockReturnValue(1000);
  const first = await storeExtensionTokenPreview(identity, preview);
  now.mockReturnValue(1000 + 31 * 60 * 1000);
  expect(await readExtensionTokenPreview(first!, identity)).toBeUndefined();
  for (let i = 0; i < 66; i += 1) {
    now.mockReturnValue(1000 + 31 * 60 * 1000 + i);
    await storeExtensionTokenPreview(identity, preview);
  }
  expect(Object.keys(records)).toHaveLength(65);
  expect(records.unrelated).toBe('preserve');
});

it('does not use session data outside an extension runtime', async () => {
  Object.defineProperty(globalThis, 'chrome', {
    configurable: true,
    value: undefined,
  });
  expect(await storeExtensionTokenPreview(identity, preview)).toBeUndefined();
  expect(
    await readExtensionTokenPreview(
      '00000000-0000-4000-8000-000000000000',
      identity,
    ),
  ).toBeUndefined();
});

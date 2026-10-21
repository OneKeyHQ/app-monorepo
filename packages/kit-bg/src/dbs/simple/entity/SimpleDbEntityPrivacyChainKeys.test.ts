import { isPrivacyChainViewingKeyMismatchError } from '../../../vaults/localWallet/viewingKeyMismatch';

import { SimpleDbEntityPrivacyChainKeys } from './SimpleDbEntityPrivacyChainKeys';

import type { IPrivacyChainKeyRecord } from './SimpleDbEntityPrivacyChainKeys';

function createEntity(initial?: unknown) {
  let saved: unknown = initial === undefined ? null : { data: initial };
  const entity = new SimpleDbEntityPrivacyChainKeys();
  (entity as { appStorage: unknown }).appStorage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  const read = () =>
    (
      (typeof saved === 'string' ? JSON.parse(saved) : saved) as {
        data: unknown;
      } | null
    )?.data;
  return { entity, read };
}

function record(
  networkId: string,
  value: string,
  vkFp = 'a'.repeat(32),
): IPrivacyChainKeyRecord {
  return { networkId, vkFp, sealed: { format: 'plain', value } };
}

describe('SimpleDbEntityPrivacyChainKeys', () => {
  it('stores and reads one record per account', async () => {
    const { entity } = createEntity();
    await entity.saveKey({ accountId: 'a', record: record('xmr--0', 'k') });

    await expect(entity.getKey({ accountId: 'a' })).resolves.toEqual(
      record('xmr--0', 'k'),
    );
    await expect(entity.getKey({ accountId: 'b' })).resolves.toBeUndefined();
  });

  it('keeps the same key and refuses another identity for the account', async () => {
    const { entity } = createEntity();
    await entity.saveKey({ accountId: 'a', record: record('xmr--0', 'k') });
    await entity.saveKey({ accountId: 'a', record: record('xmr--0', 'k') });

    const error = await entity
      .saveKey({
        accountId: 'a',
        record: record('xmr--0', 'other', 'b'.repeat(32)),
      })
      .catch((e: unknown) => e);
    expect(isPrivacyChainViewingKeyMismatchError(error)).toBe(true);
    expect((error as Error).message).not.toContain('other');
    await expect(
      entity.saveKey({ accountId: 'a', record: record('zec--0', 'k') }),
    ).rejects.toThrow('does not match');
    await expect(entity.getKey({ accountId: 'a' })).resolves.toEqual(
      record('xmr--0', 'k'),
    );
  });

  it('reads a malformed record as missing and replaces it on save', async () => {
    const { entity, read } = createEntity({
      keys: {
        bad: { networkId: 'xmr--0', value: 'old-shape' },
        good: record('xmr--0', 'k'),
      },
    });

    await expect(entity.getKey({ accountId: 'bad' })).resolves.toBeUndefined();
    await expect(entity.getKey({ accountId: 'good' })).resolves.toEqual(
      record('xmr--0', 'k'),
    );
    await expect(entity.listAccountIds()).resolves.toEqual(['bad', 'good']);

    await entity.saveKey({ accountId: 'bad', record: record('xmr--0', 'new') });
    expect(read()).toEqual({
      keys: { bad: record('xmr--0', 'new'), good: record('xmr--0', 'k') },
    });
  });

  it('writes known fields only', async () => {
    const { entity, read } = createEntity({ keys: {}, viewingKeys: { x: 1 } });
    await entity.saveKey({
      accountId: 'a',
      record: {
        ...record('xmr--0', 'k'),
        extra: 'x',
      } as IPrivacyChainKeyRecord,
    });

    expect(read()).toEqual({ keys: { a: record('xmr--0', 'k') } });
  });

  it('removes accounts, including malformed records, and one network', async () => {
    const { entity } = createEntity({
      keys: {
        bad: 'broken',
        xmr: record('xmr--0', 'k1'),
        zec: record('zec--0', 'k2'),
        zec2: record('zec--0', 'k3'),
      },
    });

    await entity.removeKeys({ accountIds: ['bad', 'xmr'] });
    await expect(entity.listAccountIds()).resolves.toEqual(['zec', 'zec2']);

    await entity.removeNetworkKeys({ networkId: 'zec--0' });
    await expect(entity.listAccountIds()).resolves.toEqual([]);
  });

  it('rejects a malformed container without echoing its content', async () => {
    const { entity } = createEntity({ keys: 'uview1secret' });

    const error = await entity
      .getKey({ accountId: 'a' })
      .catch((e: unknown) => e);
    expect((error as Error).message).toBe(
      'simpledb: invalid persisted data (privacyChainKeys)',
    );
  });
});

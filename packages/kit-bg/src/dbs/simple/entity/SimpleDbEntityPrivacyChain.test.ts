import { SimpleDbEntityPrivacyChain } from './SimpleDbEntityPrivacyChain';

function createEntity(initial: unknown) {
  let saved: unknown = initial;
  const entity = new SimpleDbEntityPrivacyChain();
  Reflect.set(entity, 'appStorage', {
    getItem: async () => saved,
    setItem: async (_key: string, value: unknown) => {
      saved = value;
    },
  });
  return { entity };
}

describe('privacy chain pending local data drop', () => {
  it('removes only the networks that were wiped', async () => {
    const { entity } = createEntity({
      data: {
        pendingLocalDataDrop: ['zec--0', 'xmr--0'],
        allowCellularSync: true,
      },
      updatedAt: 1,
    });

    await entity.removePendingLocalDataDrop({ networkIds: ['zec--0'] });

    await expect(entity.getPendingLocalDataDrop()).resolves.toEqual(['xmr--0']);
    await expect(entity.getRawData()).resolves.toEqual(
      expect.objectContaining({ allowCellularSync: true }),
    );
  });

  it('keeps a network marked after the retry read the list', async () => {
    const { entity } = createEntity({
      data: { pendingLocalDataDrop: ['xmr--0'] },
      updatedAt: 1,
    });

    await entity.removePendingLocalDataDrop({ networkIds: ['zec--0'] });

    await expect(entity.getPendingLocalDataDrop()).resolves.toEqual(['xmr--0']);
  });
});

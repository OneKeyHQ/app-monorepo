import Vault from './Vault';
import { getLocalWalletCapability } from './vaultLifecycle';

jest.mock('../../../dbs/local/localDbInstance');

function capabilityWith(diagnostics: unknown) {
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    networkId: 'zec--0',
    zcashGetApi: async () => ({
      diagnoseWalletDatabase: async () => diagnostics,
    }),
  });
  return getLocalWalletCapability(vault);
}

describe('Zcash storage usage', () => {
  // A reset deletes scan data but leaves its pages free; the file never shrinks.
  it('counts the pages in use, not the whole file', async () => {
    const capability = capabilityWith({
      databaseExists: true,
      storageStats: {
        sqlite: {
          pageSize: 4096,
          pageCount: 100,
          freePages: 60,
          logicalBytes: 409_600,
        },
      },
    });
    await expect(capability.getStorageUsage?.()).resolves.toEqual({
      bytes: 40 * 4096,
    });
  });

  it('reports nothing stored before a database exists, and unknown without stats', async () => {
    await expect(
      capabilityWith({ databaseExists: false }).getStorageUsage?.(),
    ).resolves.toEqual({ bytes: 0 });
    await expect(
      capabilityWith({
        databaseExists: true,
        storageStats: null,
      }).getStorageUsage?.(),
    ).resolves.toEqual({ bytes: null });
  });
});

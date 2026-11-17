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

// Node health is read through the runtime; the node itself is not.
describe('Zcash node status while the runtime is held', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the node with its health unknown', async () => {
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      networkId: 'zec--held-node',
      zcashGetApi: () => new Promise(() => {}),
      zcashResolveLightwalletdUrl: async () => 'https://zec.example',
    });
    const endpoint = getLocalWalletCapability(vault).getSyncEndpoint?.();
    await jest.advanceTimersByTimeAsync(1000);
    await expect(endpoint).resolves.toEqual({
      url: 'https://zec.example',
      health: undefined,
    });
  });
});

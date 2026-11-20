import { CloudSyncFlowManagerAccount } from './CloudSyncFlowManagerAccount';

import type { IDBUtxoAccount } from '../../../dbs/local/types';

describe('CloudSyncFlowManagerAccount', () => {
  const manager = new CloudSyncFlowManagerAccount({
    backgroundApi: {
      localDb: { getWalletSafe: jest.fn(async () => undefined) },
    } as any,
  });

  test('buildSyncPayload never leaks btc findAddresses (local-only field)', async () => {
    const account: Partial<IDBUtxoAccount> = {
      id: 'watching--0--bc1qxxx',
      name: 'Account #1',
      xpub: 'xpub-test',
      addresses: { '0/0': 'bc1q-main' },
      customAddresses: { '0/1': 'bc1q-custom' },
      findAddresses: { '0/100': 'bc1q-claimed' },
    };
    const payload = await manager.buildSyncPayload({
      target: {
        account,
      } as any,
    });

    expect(payload).toEqual({
      name: 'Account #1',
      accountId: 'watching--0--bc1qxxx',
    });
    expect(payload).not.toHaveProperty('findAddresses');
    expect(payload).not.toHaveProperty('customAddresses');
    expect(payload).not.toHaveProperty('addresses');
  });

  test('isSupportSync excludes accounts without a matching public snapshot wallet', async () => {
    await expect(
      manager.isSupportSync({
        account: { id: "hd-1--m/84'/0'/0'" },
      } as any),
    ).resolves.toBe(false);

    await expect(
      manager.isSupportSync({
        account: { id: 'watching--0--bc1qxxx' },
      } as any),
    ).resolves.toBe(true);
  });
});

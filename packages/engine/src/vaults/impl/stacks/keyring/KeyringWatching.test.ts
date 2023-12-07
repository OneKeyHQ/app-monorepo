import nexaMockData from '../@tests/nexaMockData';
import { testPrepareAccounts } from '../@tests/nexaPresetCase';

import { KeyringWatching } from './KeyringWatching';

import type { InvalidAddress } from '../../../../errors';

jest.setTimeout(3 * 60 * 1000);

describe('Nexa KeyringWatching Tests', () => {
  it('Nexa KeyringWatching prepareAccounts', async () => {
    const { network, watchingAccount1 } = nexaMockData;
    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: watchingAccount1.account,
        password: watchingAccount1.password,
        accountIdPrefix: 'external',
      },
      {
        keyring({ vault }) {
          return new KeyringWatching(vault);
        },
      },
    );
  });
  it('Nexa KeyringWatching prepareAccounts with wrong address', async () => {
    const { network, watchingAccount2 } = nexaMockData;
    try {
      await testPrepareAccounts(
        {
          dbNetwork: network,
          dbAccount: watchingAccount2.account,
          password: watchingAccount2.password,
          accountIdPrefix: 'external',
        },
        {
          keyring({ vault }) {
            return new KeyringWatching(vault);
          },
        },
      );
      // this is where the code hits the fan, indicating an error.
      expect(false).toBeTruthy();
    } catch (e: unknown) {
      expect((e as InvalidAddress).message).toBe('InvalidAddress.');
    }
  });

  it('Nexa KeyringWatching prepareAccounts with public key', async () => {
    const { network, watchingAccount3 } = nexaMockData;
    await testPrepareAccounts(
      {
        dbNetwork: network,
        dbAccount: watchingAccount3.account,
        password: watchingAccount3.password,
        accountIdPrefix: 'external',
      },
      {
        keyring({ vault }) {
          return new KeyringWatching(vault);
        },
      },
    );
  });

  it('Nexa KeyringWatching prepareAccounts with non-identical network address.', async () => {
    const { network, watchingAccount4 } = nexaMockData;
    try {
      await testPrepareAccounts(
        {
          dbNetwork: network,
          dbAccount: watchingAccount4.account,
          password: watchingAccount4.password,
          accountIdPrefix: 'external',
        },
        {
          keyring({ vault }) {
            return new KeyringWatching(vault);
          },
        },
      );
      // this is where the code hits the fan, indicating an error.
      expect(false).toBeTruthy();
    } catch (e: unknown) {
      expect((e as InvalidAddress).message).toBe('InvalidAddress.');
    }
  });
});

export {};

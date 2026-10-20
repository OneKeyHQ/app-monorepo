/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc/networks';

import Vault from './Vault';

import type { IDBUtxoAccount } from '../../../dbs/local/types';

it('derives change at the same address the account uses for receiving', async () => {
  const account = {
    address: 't1MZCJGByCheP3hZjEDrVTkMRwiaxTFuzJA',
    xpub: 'xpub6CTtvTVbDbZu89GVR6dCs7ezFPNTUXH4UmHYc75hWrmDq6npasnzm7qDiRebwHEmxAQxTX1HZvTZEmSiiNHDwbUu5thgjXWZcCRcQB3ovgP',
  } as IDBUtxoAccount;
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    getBtcForkNetwork: async () => getBtcForkNetwork('zec'),
  });

  await expect(
    vault.zcashTransparentChange({ account, accountIndex: 0 }),
  ).resolves.toEqual({
    address: account.address,
    derivationPath: "m/44'/133'/0'/0/0",
  });
});

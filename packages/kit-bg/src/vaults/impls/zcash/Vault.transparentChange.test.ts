/* eslint-disable import/first */
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { getBtcForkNetwork } from '@onekeyhq/core/src/chains/btc/sdkBtc/networks';
import type { IZcashTransparentTxRequest } from '@onekeyhq/core/src/chains/zcash/sdkZcash/types/sdk';

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

it.each([false, true])(
  'plans change at the receive address unless sending max (max=%s)',
  async (sendMax) => {
    const account = {
      address: 't1MZCJGByCheP3hZjEDrVTkMRwiaxTFuzJA',
      xpub: 'xpub6CTtvTVbDbZu89GVR6dCs7ezFPNTUXH4UmHYc75hWrmDq6npasnzm7qDiRebwHEmxAQxTX1HZvTZEmSiiNHDwbUu5thgjXWZcCRcQB3ovgP',
    } as IDBUtxoAccount;
    const quoteTransparentTx = jest.fn(
      async (request: IZcashTransparentTxRequest) => ({
        feeZat: '10000',
        sendAmountZat: '50000',
        spentOutpoints: request.selectedOutpoints,
      }),
    );
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      getBtcForkNetwork: async () => getBtcForkNetwork('zec'),
      validateAddress: async () => ({ isValid: true }),
      zcashFetchFreshTransparentUtxos: async () => ({
        account,
        accountIndex: 0,
        targetHeight: 3_000_000,
        utxos: [
          {
            txid: 'aa'.repeat(32),
            vout: 0,
            valueZat: '100000',
            // Change from before this release still sits on 1/0 and is spent like any other coin.
            derivationPath: "m/44'/133'/0'/1/0",
          },
        ],
      }),
      zcashGetApi: async () => ({ quoteTransparentTx }),
    });

    const encodedTx = await vault['zcashBuildTransparentEncodedTx']({
      transferInfo: {
        from: account.address,
        to: 't1XVXWCvpMgBvUaed4XDqWtgQgJSu1Ghz7F',
        amount: '0.0005',
      },
      sendMax,
    });

    const change = sendMax
      ? undefined
      : { address: account.address, derivationPath: "m/44'/133'/0'/0/0" };
    expect(quoteTransparentTx.mock.calls[0][0].change).toEqual(change);
    expect(encodedTx.zcashTransparentPlan?.change).toEqual(change);
    expect(encodedTx.inputs[0].path).toBe("m/44'/133'/0'/1/0");
  },
);

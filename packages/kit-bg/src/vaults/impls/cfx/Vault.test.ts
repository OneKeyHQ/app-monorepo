import type { IEncodedTxCfx } from '@onekeyhq/core/src/chains/cfx/types';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import CfxVault from './Vault';

describe('CfxVault.buildParseTransactionParams', () => {
  it('keeps only the fields supported by transaction security checks', async () => {
    const vault = Object.create(CfxVault.prototype) as CfxVault;
    const encodedTx: IEncodedTxCfx = {
      from: 'cfx:aak2rra2njvd77ezwjvx04kkds9fzagfe6d5r8e957',
      to: 'cfx:aam2rra2njvd77ezwjvx04kkds9fzagfe6ku8scz91',
      value: '0x0',
      data: '0x',
      nonce: 1,
      gas: '0x5208',
      gasPrice: '0x1',
      storageLimit: '0x0',
    };

    await expect(
      vault.buildParseTransactionParams({ encodedTx }),
    ).resolves.toEqual({
      encodedTx: {
        to: encodedTx.to,
        data: encodedTx.data,
        value: encodedTx.value,
      },
    });
  });
});

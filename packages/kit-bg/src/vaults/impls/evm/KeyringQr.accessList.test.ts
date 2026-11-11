import { EAirGapDataTypeEvm } from '@onekeyhq/qr-wallet-sdk';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import { KeyringQr } from './KeyringQr';

describe('QR access-list transaction envelopes', () => {
  it.each([
    { fees: { gasPrice: '1000000000' }, prefix: '01' },
    {
      fees: { maxFeePerGas: '2000000000', maxPriorityFeePerGas: '1000000000' },
      prefix: '02',
    },
  ])(
    'labels serialized type $prefix bytes as typedTransaction',
    async ({ fees, prefix }) => {
      const keyring = Object.create(KeyringQr.prototype) as KeyringQr;
      const generateSignRequest = jest.fn().mockResolvedValue({});
      Object.assign(keyring, {
        generateSignRequest,
        baseSignByQrcode: jest.fn(
          async (
            _params,
            options: {
              signRequestUrBuilder: (params: {
                path: string;
                account: { address: string };
                chainId: number;
                requestId: string;
                xfp: string;
              }) => Promise<unknown>;
            },
          ) => {
            await options.signRequestUrBuilder({
              path: "m/44'/60'/0'/0/0",
              account: {
                address: '0x1111111111111111111111111111111111111111',
              },
              chainId: 1,
              requestId: 'request-1',
              xfp: '00000000',
            });
            return {} as ISignedTxPro;
          },
        ),
      });
      await keyring.signTransaction({
        password: '',
        deviceParams: undefined,
        signOnly: true,
        unsignedTx: {
          encodedTx: {
            from: '0x1111111111111111111111111111111111111111',
            to: '0x2222222222222222222222222222222222222222',
            value: '0x0',
            data: '0x1234',
            chainId: '1',
            nonce: 1,
            gasLimit: '100000',
            accessList: [
              {
                address: '0x3333333333333333333333333333333333333333',
                storageKeys: [`0x${'11'.repeat(32)}`],
              },
            ],
            ...fees,
          },
        },
      });
      expect(generateSignRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          dataType: EAirGapDataTypeEvm.typedTransaction,
          signData: expect.stringMatching(new RegExp(`^${prefix}`, 'u')),
        }),
      );
    },
  );
});

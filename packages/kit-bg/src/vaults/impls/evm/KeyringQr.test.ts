import { packUnsignedTxForSignEvm } from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { EAirGapDataTypeEvm } from '@onekeyhq/qr-wallet-sdk';

// Importing the keyring pulls in the localDb singleton, whose constructor
// opens IndexedDB at module load and crashes under jest's node environment.
jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

// eslint-disable-next-line import/first
import { KeyringQr } from './KeyringQr';

const from = `0x${'11'.repeat(20)}`;
const accessList = [
  { address: `0x${'33'.repeat(20)}`, storageKeys: [`0x${'22'.repeat(32)}`] },
];
const baseTx: IEncodedTxEvm = {
  from,
  to: `0x${'44'.repeat(20)}`,
  value: '0x0',
  data: '0x',
  nonce: '0x1',
  gasLimit: '0x5208',
  chainId: '1',
};
const eip1559Tx: IEncodedTxEvm = {
  ...baseTx,
  maxFeePerGas: '0x77359400',
  maxPriorityFeePerGas: '0x3b9aca00',
};
const gasPriceTx: IEncodedTxEvm = { ...baseTx, gasPrice: '0x3b9aca00' };

// Runs the sign-request builder the way the QR flow does, stopping before a
// QR code would be shown, and returns what would be sent to the device.
async function buildSignRequest(encodedTx: IEncodedTxEvm) {
  const generateSignRequest = jest.fn().mockResolvedValue({});
  const keyring = Object.assign(Object.create(KeyringQr.prototype), {
    generateSignRequest,
    baseSignByQrcode: jest.fn(
      async (
        _params: unknown,
        {
          signRequestUrBuilder,
        }: { signRequestUrBuilder: (args: unknown) => Promise<unknown> },
      ) =>
        signRequestUrBuilder({
          path: "m/44'/60'/0'/0/0",
          account: { address: from },
          chainId: '1',
          requestId: 'request-id',
          xfp: 'xfp',
        }),
    ),
  }) as KeyringQr;

  await keyring.signTransaction({ unsignedTx: { encodedTx } } as never);

  return generateSignRequest.mock.calls[0][0] as {
    signData: string;
    dataType: EAirGapDataTypeEvm;
  };
}

// The air-gap firmware only parses EIP-1559 typed transactions and cannot
// sign one whose access list is not empty, so the list never goes to it.
describe('KeyringQr.signTransaction access list', () => {
  it('requests an EIP-1559 signature without the access list', async () => {
    const request = await buildSignRequest({ ...eip1559Tx, accessList });

    expect(request.dataType).toBe(EAirGapDataTypeEvm.typedTransaction);
    expect(request.signData).toBe(
      packUnsignedTxForSignEvm({ encodedTx: eip1559Tx } as never)
        .serializedTxWithout0x,
    );
  });

  it('requests a legacy signature for a gas-price transaction with an access list', async () => {
    const request = await buildSignRequest({ ...gasPriceTx, accessList });

    expect(request.dataType).toBe(EAirGapDataTypeEvm.transaction);
    expect(request.signData).toBe(
      packUnsignedTxForSignEvm({ encodedTx: gasPriceTx } as never)
        .serializedTxWithout0x,
    );
  });
});

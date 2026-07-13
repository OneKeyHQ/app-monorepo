import { SignerSoftwareBase } from '../signer/base/SignerSoftwareBase';
import { SignerHd } from '../signer/impls/sol/SignerHd';

const getAddressesFromHd = jest.fn();
const signTransaction = jest.fn();
const signMessage = jest.fn();

jest.mock('@onekeyhq/core/src/chains/sol', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    hd: {
      getAddressesFromHd,
      signTransaction,
      signMessage,
    },
  })),
}));

describe('sol hd signer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(SignerSoftwareBase.prototype as any, 'baseGetHdCredential')
      .mockResolvedValue('hd-credential');
    jest
      .spyOn(SignerSoftwareBase.prototype as any, 'baseGetEncodedPassword')
      .mockResolvedValue('encoded-password');
  });

  it('derives first receive address using OneKey default template', async () => {
    getAddressesFromHd.mockResolvedValue({
      addresses: [
        {
          address: 'SoLfirstAddress',
          path: "m/44'/501'/0'/0'",
          publicKey: 'SoLfirstAddress',
        },
      ],
    });

    const signer = new SignerHd();
    const address = await signer.getAddress('sol--101');

    expect(address).toEqual({
      address: 'SoLfirstAddress',
      path: "m/44'/501'/0'/0'",
      publicKey: 'SoLfirstAddress',
    });
    expect(getAddressesFromHd).toHaveBeenCalledWith({
      networkInfo: {
        networkChainCode: 'sol',
        chainId: '101',
        networkImpl: 'sol',
        networkId: 'sol--101',
      },
      template: "m/44'/501'/$$INDEX$$'/0'",
      hdCredential: 'hd-credential',
      password: 'onekey',
      indexes: [0],
      addressEncoding: undefined,
    });
  });

  it('rejects non-SOL networkIds before touching the HD credential', async () => {
    const signer = new SignerHd();
    await expect(signer.getAddress('evm--1')).rejects.toThrow(
      /Unsupported SOL networkId/,
    );
    expect(getAddressesFromHd).not.toHaveBeenCalled();
  });

  it('forwards signTransaction payload to core sol scope', async () => {
    signTransaction.mockResolvedValue({
      rawTx: 'base64-raw',
      txid: 'bs58-sig',
    });

    const signer = new SignerHd();
    const result = await signer.signTransaction({
      networkId: 'sol--101',
      account: {
        address: 'SoLfirstAddress',
        path: "m/44'/501'/0'/0'",
        pub: 'SoLfirstAddress',
      },
      unsignedTx: {
        encodedTx: 'bs58-encoded-tx' as unknown as Record<string, unknown>,
      },
    });

    expect(result).toEqual({ rawTx: 'base64-raw', txid: 'bs58-sig' });
    expect(signTransaction).toHaveBeenCalledWith({
      networkInfo: {
        networkChainCode: 'sol',
        chainId: '101',
        networkImpl: 'sol',
        networkId: 'sol--101',
      },
      password: 'encoded-password',
      credentials: { hd: 'hd-credential' },
      account: {
        address: 'SoLfirstAddress',
        path: "m/44'/501'/0'/0'",
        pub: 'SoLfirstAddress',
      },
      unsignedTx: { encodedTx: 'bs58-encoded-tx' },
    });
  });

  it('delegates signMessage to core sol scope (parity with EVM)', async () => {
    signMessage.mockResolvedValue('bs58-signature');
    const signer = new SignerHd();

    const sig = await signer.signMessage({
      unsignedMsg: { type: 'commonSignMessage', message: 'hello' },
    } as never);

    expect(sig).toBe('bs58-signature');
    expect(signMessage).toHaveBeenCalledWith({
      unsignedMsg: { type: 'commonSignMessage', message: 'hello' },
    });
  });
});

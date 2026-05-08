import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { getBtcAddressTypeInfo } from '../core/btc/address-types';
import { SignerSoftwareBase } from '../signer/base/SignerSoftwareBase';
import { SignerHd } from '../signer/impls/btc/SignerHd';

const getAddressesFromHd = jest.fn();
const signTransaction = jest.fn();

jest.mock('@onekeyhq/core/src/chains/btc', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      hd: {
        getAddressesFromHd,
        signTransaction,
      },
    })),
  };
});

describe('btc hd signer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(SignerSoftwareBase.prototype as any, 'baseGetHdCredential')
      .mockResolvedValue('hd-credential');
    jest
      .spyOn(SignerSoftwareBase.prototype as any, 'baseGetEncodedPassword')
      .mockResolvedValue('encoded-password');
  });

  it('derives first receive address for tbtc taproot', async () => {
    getAddressesFromHd.mockResolvedValue({
      addresses: [
        {
          address: 'tb1p-first',
          path: "m/86'/1'/0'/0/0",
        },
      ],
    });

    const signer = new SignerHd({ impl: 'tbtc' });
    const address = await signer.getAddress('tbtc--0', {
      addressType: 'taproot',
    });

    expect(address).toEqual({
      address: 'tb1p-first',
      path: "m/86'/1'/0'/0/0",
    });
    expect(getAddressesFromHd).toHaveBeenCalledWith({
      networkInfo: {
        networkChainCode: 'tbtc',
        chainId: '0',
        networkImpl: 'tbtc',
        networkId: 'tbtc--0',
      },
      template: "m/86'/1'/$$INDEX$$'/0/0",
      hdCredential: 'hd-credential',
      password: 'onekey',
      indexes: [0],
      addressEncoding: EAddressEncodings.P2TR,
    });
    expect(getBtcAddressTypeInfo('tbtc', 'taproot').path).toBe(
      "m/86'/1'/0'/0/0",
    );
  });

  it('passes btc signing extras through to core hd signer', async () => {
    signTransaction.mockResolvedValue({
      rawTx: 'raw-tx',
      txid: 'tx-id',
    });

    const btcExtraInfo = {
      pathToAddresses: {
        "m/86'/0'/0'/0/0": {
          address: 'bc1p-input',
          relPath: '0/0',
          fullPath: "m/86'/0'/0'/0/0",
        },
      },
      addressToPath: {},
      inputAddressesEncodings: [EAddressEncodings.P2TR],
      nonWitnessPrevTxs: {},
    };
    const signer = new SignerHd({ impl: 'btc' });

    const result = await signer.signTransaction({
      networkId: 'btc--0',
      account: {
        address: 'bc1p-input',
        path: "m/86'/0'/0'",
      },
      unsignedTx: { encodedTx: { inputs: [], outputs: [] } },
      relPaths: ['0/0'],
      btcExtraInfo,
      signOnly: true,
      addressType: 'taproot',
    });

    expect(result).toEqual({
      rawTx: 'raw-tx',
      txid: 'tx-id',
    });
    expect(signTransaction).toHaveBeenCalledWith({
      networkInfo: {
        networkChainCode: 'btc',
        chainId: '0',
        networkImpl: 'btc',
        networkId: 'btc--0',
      },
      password: 'encoded-password',
      credentials: { hd: 'hd-credential' },
      account: {
        address: 'bc1p-input',
        path: "m/86'/0'/0'",
        pub: undefined,
      },
      unsignedTx: { encodedTx: { inputs: [], outputs: [] } },
      relPaths: ['0/0'],
      btcExtraInfo,
      signOnly: true,
      addressEncoding: EAddressEncodings.P2TR,
    });
  });

  it('rejects btc message signing', async () => {
    const signer = new SignerHd({ impl: 'btc' });

    await expect(signer.signMessage({} as never)).rejects.toThrow(
      /BTC message signing/,
    );
  });
});

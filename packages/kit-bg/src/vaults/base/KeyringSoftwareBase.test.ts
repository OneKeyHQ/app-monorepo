import type {
  ICoreApiNetworkInfo,
  ICoreApiSignMsgPayload,
  ICoreCredentialsInfo,
} from '@onekeyhq/core/src/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';

import { KeyringSoftwareBase } from './KeyringSoftwareBase';

jest.mock('../../dbs/local/localDb', () => ({
  __esModule: true,
  default: {},
}));

describe('KeyringSoftwareBase', () => {
  const setupKeyring = () => {
    const account = {
      address: '0x1234',
      path: "m/44'/60'/0'/0/0",
    };
    const credentials: ICoreCredentialsInfo = {
      hd: 'encrypted-hd-credential',
    };
    const networkInfo = {
      addressPrefix: '',
      chainId: '1',
      curve: 'secp256k1',
      isTestnet: false,
      networkChainCode: 'eth',
      networkId: 'evm--1',
      networkImpl: 'evm',
    } as ICoreApiNetworkInfo;
    const signMessage = jest
      .fn<Promise<string>, [ICoreApiSignMsgPayload]>()
      .mockResolvedValue('signature');
    const keyring = Object.create(
      KeyringSoftwareBase.prototype,
    ) as KeyringSoftwareBase;

    Object.defineProperties(keyring, {
      coreApi: {
        value: { signMessage },
        writable: true,
      },
      vault: {
        value: {
          getAccount: async () => account,
        },
        writable: true,
      },
    });
    jest
      .spyOn(keyring, 'baseGetCredentialsInfo')
      .mockResolvedValue(credentials);
    jest.spyOn(keyring, 'getCoreApiNetworkInfo').mockResolvedValue(networkInfo);

    return { keyring, signMessage };
  };

  const message = {
    message: 'approve agent',
    type: EMessageTypesEth.PERSONAL_SIGN,
  };

  it('forwards caller-provided KDF parameters', async () => {
    const { keyring, signMessage } = setupKeyring();

    await keyring.baseSignMessage({
      deviceParams: undefined,
      messages: [message],
      password: 'encoded-password',
      kdfBackend: 'webcrypto',
      enablePbkdf2Cache: false,
    } as Parameters<KeyringSoftwareBase['baseSignMessage']>[0] & {
      enablePbkdf2Cache: false;
      kdfBackend: 'webcrypto';
    });

    expect(signMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        enablePbkdf2Cache: false,
        kdfBackend: 'webcrypto',
      }),
    );
  });

  it('does not opt ordinary message signing into another KDF', async () => {
    const { keyring, signMessage } = setupKeyring();

    await keyring.baseSignMessage({
      deviceParams: undefined,
      messages: [message],
      password: 'encoded-password',
    });

    expect(signMessage).toHaveBeenCalledWith(
      expect.not.objectContaining({
        kdfBackend: expect.anything(),
      }),
    );
  });
});

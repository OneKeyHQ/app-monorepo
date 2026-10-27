/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance');

import { getViewingKeyFingerprint } from '../../localWallet/viewingKeyFingerprint';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import Vault from './Vault';

const ACCOUNT_ID = "hd-1--m/44'/128'/0'";
const VIEWING_KEY = 'aa:bb';
const VK_FP = getViewingKeyFingerprint({
  networkId: 'xmr--0',
  viewingKey: VIEWING_KEY,
});
const privacyChainKeys = {
  getKey: async () => ({
    networkId: 'xmr--0',
    vkFp: VK_FP,
    sealed: { format: 'plain', value: VIEWING_KEY },
  }),
};

// Key images (spend key) are computed only when some output still lacks one.
function createVault(outputsWithoutKeyImage: number, spendsFound = 0) {
  const api = {
    listAccounts: async () =>
      JSON.stringify({ items: [{ accountId: 7, uuid: VK_FP }] }),
    balance: jest.fn(async () => JSON.stringify({ outputsWithoutKeyImage })),
    importKeyImagesWithBip32Key: jest.fn(async () =>
      JSON.stringify({ imported: outputsWithoutKeyImage, spendsFound }),
    ),
  };
  const keyring = Object.assign(
    Object.create(KeyringHd.prototype) as KeyringHd,
    {
      xmrGetKeyImageBip32PrivateKeyHex: jest.fn(async () => 'bip32-key-hex'),
    },
  );
  const promptPasswordVerifyByAccount = jest.fn(async () => ({
    password: 'pw',
  }));
  const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
    accountId: ACCOUNT_ID,
    networkId: 'xmr--0',
    keyring,
    getXmrRuntimeApi: async () => api,
    backgroundApi: {
      servicePassword: { promptPasswordVerifyByAccount },
      simpleDb: { privacyChainKeys },
    },
  });
  const ensure = () =>
    (
      vault as unknown as {
        xmrEnsureKeyImages: (p: {
          api: unknown;
          identityId: string;
        }) => Promise<void>;
      }
    ).xmrEnsureKeyImages({ api, identityId: '7' });
  return { vault, api, keyring, promptPasswordVerifyByAccount, ensure };
}

describe('xmr key images', () => {
  it('asks for nothing before a send when every output has a key image', async () => {
    const { ensure, promptPasswordVerifyByAccount, api } = createVault(0);
    await ensure();
    expect(promptPasswordVerifyByAccount).not.toHaveBeenCalled();
    expect(api.importKeyImagesWithBip32Key).not.toHaveBeenCalled();
  });

  it('imports key images from the password before a send when some are missing', async () => {
    const { ensure, promptPasswordVerifyByAccount, api, keyring } =
      createVault(2);
    await ensure();
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(keyring.xmrGetKeyImageBip32PrivateKeyHex).toHaveBeenCalledWith({
      password: 'pw',
    });
    expect(api.importKeyImagesWithBip32Key).toHaveBeenCalledTimes(1);
    expect(api.importKeyImagesWithBip32Key).toHaveBeenCalledWith(
      '7',
      'bip32-key-hex',
    );
  });

  it('reports password work only while outputs lack key images', async () => {
    await expect(
      createVault(0).vault.localWalletHasPasswordWork(),
    ).resolves.toBe(false);
    await expect(
      createVault(3).vault.localWalletHasPasswordWork(),
    ).resolves.toBe(true);
  });

  it('reports a state change whenever key images are imported', async () => {
    await expect(
      createVault(2, 1).vault.localWalletDoPasswordWork({ password: 'pw' }),
    ).resolves.toBe(true);
    await expect(
      createVault(2, 0).vault.localWalletDoPasswordWork({ password: 'pw' }),
    ).resolves.toBe(true);
    await expect(
      createVault(0, 0).vault.localWalletDoPasswordWork({ password: 'pw' }),
    ).resolves.toBe(false);
  });
});

describe('xmr key-image key', () => {
  it('fetches the BIP-32 key, not a spend key, from the core with the password credentials', async () => {
    const getKeyImageBip32PrivateKeyHex = jest.fn(async () => 'bip32-key-hex');
    const keyring = Object.assign(
      Object.create(KeyringHd.prototype) as KeyringHd,
      {
        vault: { getAccount: async () => ({ id: ACCOUNT_ID }) },
        coreApi: { getKeyImageBip32PrivateKeyHex },
        baseGetCredentialsInfo: async () => ({ hd: 'hd-credential' }),
        getCoreApiNetworkInfo: async () => ({ networkId: 'xmr--0' }),
      },
    );
    await expect(
      keyring.xmrGetKeyImageBip32PrivateKeyHex({ password: 'pw' }),
    ).resolves.toBe('bip32-key-hex');
    expect(getKeyImageBip32PrivateKeyHex).toHaveBeenCalledWith({
      networkInfo: { networkId: 'xmr--0' },
      account: { id: ACCOUNT_ID },
      password: 'pw',
      credentials: { hd: 'hd-credential' },
    });
    expect('xmrGetSpendPrivateKeyHex' in keyring).toBe(false);
  });
});

// A hardware account's device computes the key images; the runtime verifies them.
describe('xmr key images from the device', () => {
  const transfer = {
    outputId: 11,
    outKey: 'aa'.repeat(32),
    txPubKey: 'bb'.repeat(32),
    additionalTxPubKey: null,
    internalOutputIndex: 0,
    subAddrMajor: 0,
    subAddrMinor: 0,
  };
  const deviceParams = { dbDevice: { connectId: 'c', deviceId: 'd' } };

  function createHardwareVault(transfers: (typeof transfer)[]) {
    const api = {
      listAccounts: async () =>
        JSON.stringify({ items: [{ accountId: 7, uuid: VK_FP }] }),
      balance: jest.fn(async () =>
        JSON.stringify({ outputsWithoutKeyImage: transfers.length }),
      ),
      exportKeyImageSyncData: jest.fn(async () =>
        JSON.stringify({ items: transfers }),
      ),
      importDeviceKeyImages: jest.fn(async () =>
        JSON.stringify({ imported: transfers.length, spendsFound: 1 }),
      ),
    };
    const keyring = Object.assign(
      Object.create(KeyringHardware.prototype) as KeyringHardware,
      {
        xmrGetKeyImagesFromDevice: jest.fn(async () =>
          transfers.map(() => ({
            keyImage: 'cc'.repeat(32),
            signature: 'dd'.repeat(64),
          })),
        ),
      },
    );
    const vault = Object.assign(Object.create(Vault.prototype) as Vault, {
      accountId: "hw-1--m/44'/128'/0'",
      networkId: 'xmr--0',
      keyring,
      getXmrRuntimeApi: async () => api,
      backgroundApi: { simpleDb: { privacyChainKeys } },
    });
    return { vault, api, keyring };
  }

  it('hands the runtime each device key image under the output it was asked for', async () => {
    const { vault, api, keyring } = createHardwareVault([transfer]);

    await expect(vault.localWalletHasDeviceWork()).resolves.toBe(true);
    await expect(
      vault.localWalletDoDeviceWork({ deviceParams } as never),
    ).resolves.toBe(true);

    expect(keyring.xmrGetKeyImagesFromDevice).toHaveBeenCalledWith({
      deviceParams,
      transfers: [transfer],
    });
    expect(api.importDeviceKeyImages).toHaveBeenCalledWith(
      '7',
      JSON.stringify([
        { keyImage: 'cc'.repeat(32), outputId: 11, signature: 'dd'.repeat(64) },
      ]),
    );
  });

  it('does not reach for the device when nothing waits for a key image', async () => {
    const { vault, keyring } = createHardwareVault([]);

    await expect(vault.localWalletHasDeviceWork()).resolves.toBe(false);
    await expect(
      vault.localWalletDoDeviceWork({ deviceParams } as never),
    ).resolves.toBe(false);
    expect(keyring.xmrGetKeyImagesFromDevice).not.toHaveBeenCalled();
  });

  it('leaves a software account to its password', async () => {
    const { vault } = createVault(2);

    await expect(vault.localWalletHasDeviceWork()).resolves.toBe(false);
  });
});

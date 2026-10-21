/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { KeyringHd } from './KeyringHd';
import Vault from './Vault';

const ACCOUNT_ID = "hd-1--m/44'/128'/0'";

// Key images (spend key) reveal spends made elsewhere; computed from the
// password only when some output still lacks one.
function createVault(outputsWithoutKeyImage: number, spendsFound = 0) {
  const api = {
    listAccounts: async () =>
      JSON.stringify({ items: [{ accountId: 7, uuid: ACCOUNT_ID }] }),
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
    backgroundApi: { servicePassword: { promptPasswordVerifyByAccount } },
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
    // One crossing with the BIP-32 key; the runtime reduces the spend key.
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

  it('reports a state change when importing uncovers spends made elsewhere', async () => {
    await expect(
      createVault(2, 1).vault.localWalletDoPasswordWork({ password: 'pw' }),
    ).resolves.toBe(true);
    await expect(
      createVault(2, 0).vault.localWalletDoPasswordWork({ password: 'pw' }),
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

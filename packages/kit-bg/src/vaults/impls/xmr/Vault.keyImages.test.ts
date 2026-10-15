/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import { KeyringHd } from './KeyringHd';
import Vault from './Vault';

const ACCOUNT_ID = "hd-1--m/44'/128'/0'";

// The scan is watch-only; key images (which need the spend key) are what let
// it find spends made outside this app. They are computed from the password
// only when some output still lacks one.
function createVault(outputsWithoutKeyImage: number, spendsFound = 0) {
  const api = {
    listAccounts: async () =>
      JSON.stringify({ items: [{ accountId: 7, uuid: ACCOUNT_ID }] }),
    balance: jest.fn(async () => JSON.stringify({ outputsWithoutKeyImage })),
    importKeyImages: jest.fn(async () =>
      JSON.stringify({ imported: outputsWithoutKeyImage, spendsFound }),
    ),
  };
  const keyring = Object.assign(
    Object.create(KeyringHd.prototype) as KeyringHd,
    {
      xmrGetSpendPrivateKeyHex: jest.fn(async () => 'spend-key-hex'),
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
    expect(api.importKeyImages).not.toHaveBeenCalled();
  });

  it('imports key images from the password before a send when some are missing', async () => {
    const { ensure, promptPasswordVerifyByAccount, api, keyring } =
      createVault(2);
    await ensure();
    expect(promptPasswordVerifyByAccount).toHaveBeenCalledTimes(1);
    expect(keyring.xmrGetSpendPrivateKeyHex).toHaveBeenCalledWith({
      password: 'pw',
    });
    expect(api.importKeyImages).toHaveBeenCalledWith('7', 'spend-key-hex');
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

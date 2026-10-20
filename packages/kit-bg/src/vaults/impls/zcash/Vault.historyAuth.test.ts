/* eslint-disable import/first */

jest.mock('../../../dbs/local/localDbInstance', () => ({
  __esModule: true,
  default: {},
}));

import Vault from './Vault';

// Watch-only accounts are excluded from KYT: the server must never receive
// the OneKey ID token for their addresses.
describe('Zcash transparent history auth headers', () => {
  async function requestHeaders(accountId: string) {
    const post = jest.fn(async () => ({
      data: { data: { data: [], tokens: {}, nfts: {} } },
    }));
    const vault = Object.assign(Object.create(Vault.prototype) as object, {
      accountId,
      networkId: 'zec--0',
      backgroundApi: {
        simpleDb: {
          zcash: {
            getAccountMeta: async () => ({ transparentAddress: 't1-own' }),
          },
        },
        serviceHistory: {
          getClient: async () => ({ post }),
          getOneKeyIdAuthHeaders: async () => ({ 'x-auth': 'token' }),
        },
        serviceAccountProfile: {
          _getWalletTypeHeader: async () => ({ 'x-wallet-type': 'hd' }),
        },
      },
    }) as unknown as Vault;
    await vault.zcashFetchTransparentHistory({
      accountId,
      networkId: 'zec--0',
      accountAddress: 't1-own',
      xpub: '',
    });
    const calls = post.mock.calls as unknown as [
      string,
      unknown,
      { headers: Record<string, string> },
    ][];
    return calls[0][2].headers;
  }

  it('authenticates an owned account', async () => {
    await expect(requestHeaders("hd-1--m/44'/133'/0'")).resolves.toMatchObject({
      'x-auth': 'token',
    });
  });

  it('withholds the token for a watch-only account', async () => {
    const headers = await requestHeaders('watching--zec--0--t1-own');
    expect(headers).not.toHaveProperty('x-auth');
    expect(headers).toMatchObject({ 'x-wallet-type': 'hd' });
  });
});

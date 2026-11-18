/* eslint-disable import/first */
// cspell:ignore trxres
/*
yarn jest packages/kit-bg/src/services/ServiceAccountProfile.trxresAuth.test.ts

OK-67058: TRON energy issuance is bound to the signed-in OneKey ID. Every
/wallet/v1/proxy/trxres request carries the login token when a session
exists and none when signed out, and the token is attached to that single
request rather than to the shared Wallet client.
*/

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const ServiceAccountProfile = require('./ServiceAccountProfile')
  .default as typeof import('./ServiceAccountProfile').default;

const networkId = 'tron--0x2b6653dc';
const body = {
  method: 'post',
  url: '/api/tronRent/addFreeTronRentRecord',
  data: { fromAddress: 'TAddress' },
  params: {},
};

function createService({ authToken }: { authToken?: string }) {
  const post = jest.fn(async () => ({
    data: { code: 0, message: 'success', data: { success: true } },
  }));
  const service = Object.assign(
    Object.create(ServiceAccountProfile.prototype) as InstanceType<
      typeof ServiceAccountProfile
    >,
    {
      getClient: async () => ({ post }),
      getOneKeyIdAuthHeaders: async () =>
        authToken ? { 'X-Onekey-Request-Token': authToken } : {},
    },
  );
  return { service, post };
}

describe('ServiceAccountProfile.sendProxyRequestWithTrxRes auth header', () => {
  it('carries the OneKey ID token when a session exists', async () => {
    const { service, post } = createService({ authToken: 'token-a' });

    const result = await service.sendProxyRequestWithTrxRes<{
      success: boolean;
    }>({ networkId, body });

    expect(result).toEqual({ success: true });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/wallet/v1/proxy/trxres',
      { networkId, ...body },
      { headers: { 'X-Onekey-Request-Token': 'token-a' } },
    );
  });

  it('sends no token when signed out', async () => {
    const { service, post } = createService({});

    await service.sendProxyRequestWithTrxRes({
      networkId,
      body,
      returnRawData: true,
    });

    expect(post).toHaveBeenCalledWith(
      '/wallet/v1/proxy/trxres',
      { networkId, ...body },
      { headers: {} },
    );
  });
});

/* eslint-disable import/first */
// cspell:ignore trxres
/*
yarn jest packages/kit-bg/src/services/ServiceAccountProfile.trxresAuth.test.ts

OK-67058: TRON energy issuance is bound to the signed-in OneKey ID. Every
/wallet/v1/proxy/trxres request carries the login token when a session
exists and none when signed out, and the token is attached to that single
request rather than to the shared Wallet client. The token must also stay out
of a serialized request error: callers log those (the automatic claim before
a TRON transfer does), and a timeout rejects with the request config attached.
*/

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const { AxiosError, AxiosHeaders } = require('axios') as typeof import('axios');

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
      {
        headers: { 'X-Onekey-Request-Token': 'token-a' },
        redact: ['X-Onekey-Request-Token'],
      },
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
      { headers: {}, redact: ['X-Onekey-Request-Token'] },
    );
  });

  it('keeps the token out of a serialized request error', async () => {
    const { service, post } = createService({ authToken: 'token-a' });
    await service.sendProxyRequestWithTrxRes({ networkId, body });
    const [, , requestConfig] = post.mock.calls[0] as unknown as [
      string,
      unknown,
      { headers: Record<string, string>; redact: string[] },
    ];

    // What a timeout rejects with: the error carries the request's config.
    const timeout = new AxiosError('timeout exceeded', 'ECONNABORTED', {
      ...requestConfig,
      headers: new AxiosHeaders(requestConfig.headers),
    });
    const serialized = JSON.stringify(timeout);

    expect(serialized).toContain('timeout exceeded');
    expect(serialized).not.toContain('token-a');
  });
});

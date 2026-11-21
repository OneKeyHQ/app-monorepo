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

An issuance the user starts by hand (free claim, code redemption) names the
member it was started for. It is posted only with that member's session: when
the session is gone, belongs to someone else or its token cannot be read,
nothing is sent, so the issuance is never accepted anonymously or for another
member while the UI reports it to the one who asked.
*/

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators');

const { AxiosError, AxiosHeaders } = require('axios') as typeof import('axios');

const { ETranslations } =
  require('@onekeyhq/shared/src/locale') as typeof import('@onekeyhq/shared/src/locale');

const ServiceAccountProfile = require('./ServiceAccountProfile')
  .default as typeof import('./ServiceAccountProfile').default;

const networkId = 'tron--0x2b6653dc';
const body = {
  method: 'post',
  url: '/api/tronRent/addFreeTronRentRecord',
  data: { fromAddress: 'TAddress' },
  params: {},
};

// `authToken` is what the per-request header read returns (none when signed
// out, and none when the token cannot be read). `signedInAs` is the member
// ServicePrime can pin a session for.
function createService({
  authToken,
  signedInAs,
}: {
  authToken?: string;
  signedInAs?: string;
}) {
  const post = jest.fn(async () => ({
    data: { code: 0, message: 'success', data: { success: true } },
  }));
  const getOneKeyIdAuthHeaders = jest.fn(
    async (): Promise<Record<string, string>> =>
      authToken ? { 'X-Onekey-Request-Token': authToken } : {},
  );
  // What ServicePrime does: a snapshot can only be taken for the member that
  // is signed in.
  const captureOneKeyIdAuthRequestConfig = jest.fn(
    async ({
      expectedOneKeyUserId,
      createStateChangedError,
    }: {
      expectedOneKeyUserId: string;
      createStateChangedError: () => Error;
    }) => {
      if (!expectedOneKeyUserId || expectedOneKeyUserId !== signedInAs) {
        throw createStateChangedError();
      }
      return {
        snapshot: { expectedOneKeyUserId },
        requestConfig: {
          headers: { 'X-Onekey-Request-Token': `token-${signedInAs}` },
        },
      };
    },
  );
  const service = Object.assign(
    Object.create(ServiceAccountProfile.prototype) as InstanceType<
      typeof ServiceAccountProfile
    >,
    {
      getClient: async () => ({ post }),
      getOneKeyIdAuthHeaders,
      backgroundApi: { servicePrime: { captureOneKeyIdAuthRequestConfig } },
    },
  );
  return {
    service,
    post,
    getOneKeyIdAuthHeaders,
    captureOneKeyIdAuthRequestConfig,
  };
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

describe('ServiceAccountProfile.sendProxyRequestWithTrxRes explicit issuance', () => {
  it('posts with the session of the member the issuance was started for', async () => {
    const { service, post, getOneKeyIdAuthHeaders } = createService({
      authToken: 'token-of-whoever-is-current',
      signedInAs: 'user-a',
    });

    await service.sendProxyRequestWithTrxRes({
      networkId,
      body,
      issuedTo: { onekeyUserId: 'user-a' },
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(
      '/wallet/v1/proxy/trxres',
      { networkId, ...body },
      {
        headers: { 'X-Onekey-Request-Token': 'token-user-a' },
        redact: ['X-Onekey-Request-Token'],
      },
    );
    // The member is never taken from whatever session is current.
    expect(getOneKeyIdAuthHeaders).not.toHaveBeenCalled();
  });

  it.each([
    ['the member signed out', undefined, 'user-a'],
    ['another member signed in', 'user-b', 'user-a'],
    ['the session carries no OneKey ID', 'user-a', undefined],
  ])('posts nothing when %s', async (_name, signedInAs, onekeyUserId) => {
    const { service, post } = createService({
      authToken: signedInAs ? `token-${signedInAs}` : undefined,
      signedInAs,
    });

    await expect(
      service.sendProxyRequestWithTrxRes({
        networkId,
        body,
        issuedTo: { onekeyUserId },
      }),
    ).rejects.toMatchObject({
      key: ETranslations.id_login_expired_description,
    });

    expect(post).not.toHaveBeenCalled();
  });

  it('posts nothing when the session token cannot be read', async () => {
    // A failing token refresh: the per-request read degrades to no header,
    // which would send the issuance anonymously.
    const { service, post, captureOneKeyIdAuthRequestConfig } = createService({
      signedInAs: 'user-a',
    });
    const refreshFailed = new Error('token refresh failed');
    captureOneKeyIdAuthRequestConfig.mockRejectedValue(refreshFailed);

    await expect(
      service.sendProxyRequestWithTrxRes({
        networkId,
        body,
        issuedTo: { onekeyUserId: 'user-a' },
      }),
    ).rejects.toBe(refreshFailed);

    expect(post).not.toHaveBeenCalled();
  });
});

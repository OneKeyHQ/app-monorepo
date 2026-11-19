import { createAuthFetch } from './authTransport';

const emailProject = {
  origin: 'https://email-preview.example.invalid',
  publicKey: 'fixture-public-key',
};
const oauthProject = {
  origin: 'https://oauth-preview.example.invalid',
  publicKey: 'fixture-public-key',
};

describe('isolated Keyless OAuth transport', () => {
  it('limits the OAuth client to its own PKCE token exchange and omits cookies and redirects', async () => {
    const send = jest.fn<
      Promise<Response>,
      [input: RequestInfo | URL, init?: RequestInit]
    >();
    send.mockResolvedValue(new Response());
    const controller = new AbortController();
    const request = createAuthFetch(oauthProject, controller.signal, send);
    await request(`${oauthProject.origin}/auth/v1/token?grant_type=pkce`, {
      method: 'POST',
    });
    expect(send).toHaveBeenCalledWith(
      expect.any(Request),
      expect.objectContaining({
        credentials: 'omit',
        redirect: 'error',
        cache: 'no-store',
      }),
    );
    for (const path of [
      '/prime/v1/keyless-deletion/delete',
      '/prime/v1/keyless-deletion/otp/send',
      '/auth/v1/logout',
      '/auth/v1/otp',
      '/auth/v1/verify',
      '/auth/v1/token?grant_type=refresh_token',
    ]) {
      await expect(
        request(`${oauthProject.origin}${path}`, { method: 'POST' }),
      ).rejects.toMatchObject({ name: 'SecurityError' });
    }
    await expect(
      request(`${emailProject.origin}/auth/v1/token?grant_type=pkce`, {
        method: 'POST',
      }),
    ).rejects.toMatchObject({ name: 'SecurityError' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong method and stops after cancellation', async () => {
    const send = jest.fn<
      Promise<Response>,
      [input: RequestInfo | URL, init?: RequestInit]
    >();
    const controller = new AbortController();
    const request = createAuthFetch(oauthProject, controller.signal, send);
    const url = `${oauthProject.origin}/auth/v1/token?grant_type=pkce`;
    await expect(request(url)).rejects.toMatchObject({ name: 'SecurityError' });
    controller.abort();
    await expect(request(url, { method: 'POST' })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(send).not.toHaveBeenCalled();
  });
});

import { runInNewContext } from 'node:vm';

import {
  INTERCOM_SUPPORT_ORIGIN,
  INTERCOM_SUPPORT_URL,
  createIntercomSessionMessage,
  createIntercomSessionScript,
  isIntercomBridgeHandshake,
  isIntercomNativeHandshake,
  normalizeIntercomSupportUrl,
  resolveIntercomSupportOrigin,
  resolveIntercomSupportUrlOverride,
} from './bridge';

const PREVIEW_ORIGIN = 'https://intercom-preview.onekey.test';

function runSessionScript(
  script: string,
  {
    origin = INTERCOM_SUPPORT_ORIGIN,
    isFrame = false,
  }: { origin?: string; isFrame?: boolean } = {},
) {
  const postMessage = jest.fn();
  const self = {};
  const page = {
    location: { origin },
    postMessage,
    self,
    top: isFrame ? {} : self,
  };
  runInNewContext(script, { window: page });
  return postMessage;
}

describe('Intercom bridge', () => {
  it('pins the wire contract shared with the hosted support page', () => {
    expect(createIntercomSessionMessage('token')).toEqual({
      type: 'onekey-intercom-session',
      version: 1,
      token: 'token',
    });
    expect(createIntercomSessionMessage()).toEqual({
      type: 'onekey-intercom-session',
      version: 1,
    });
  });

  it('posts the session to the support origin from inside the page', () => {
    const postMessage = runSessionScript(createIntercomSessionScript('token'));
    expect(postMessage).toHaveBeenCalledTimes(1);
    const [message, targetOrigin] = postMessage.mock.calls[0] as [
      unknown,
      string,
    ];
    expect(JSON.parse(JSON.stringify(message))).toEqual(
      createIntercomSessionMessage('token'),
    );
    expect(targetOrigin).toBe(INTERCOM_SUPPORT_ORIGIN);
  });

  it('withholds the session from any other document', () => {
    const script = createIntercomSessionScript('token');
    expect(
      runSessionScript(script, { origin: 'https://evil.test' }),
    ).not.toHaveBeenCalled();
    expect(runSessionScript(script, { isFrame: true })).not.toHaveBeenCalled();
  });

  it('cannot be broken out of by the token text', () => {
    const token = '"});window.pwned=true;//';
    const postMessage = runSessionScript(createIntercomSessionScript(token));
    const [message] = postMessage.mock.calls[0] as [{ token: string }];
    expect(message.token).toBe(token);
  });

  it('recognizes only the version 1 handshake', () => {
    const handshake = { type: 'onekey-intercom-bridge', version: 1 };
    expect(isIntercomBridgeHandshake(handshake)).toBe(true);
    expect(isIntercomBridgeHandshake({ ...handshake, version: 2 })).toBe(false);
    expect(isIntercomBridgeHandshake({ version: 1 })).toBe(false);
    expect(isIntercomBridgeHandshake('onekey-intercom-bridge')).toBe(false);
    expect(isIntercomBridgeHandshake(null)).toBe(false);
  });

  it('targets an overridden support origin only', () => {
    const script = createIntercomSessionScript('token', PREVIEW_ORIGIN);
    const postMessage = runSessionScript(script, { origin: PREVIEW_ORIGIN });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0][1]).toBe(PREVIEW_ORIGIN);
    expect(runSessionScript(script)).not.toHaveBeenCalled();
  });

  describe('support URL override', () => {
    it('accepts HTTPS URLs and drops the fragment', () => {
      expect(
        normalizeIntercomSupportUrl(`  ${PREVIEW_ORIGIN}/path?x=1#old  `),
      ).toBe(`${PREVIEW_ORIGIN}/path?x=1`);
      expect(normalizeIntercomSupportUrl('https://192.168.1.2:5173')).toBe(
        'https://192.168.1.2:5173/',
      );
    });

    it.each([
      'http://localhost:5173/',
      'http://127.0.0.1:5173/',
      'http://[::1]:5173/',
    ])('accepts loopback HTTP %p', (value) => {
      expect(normalizeIntercomSupportUrl(value)).toBe(value);
    });

    // The page receives the session JWT, so it must never travel in cleartext.
    it.each([
      undefined,
      '',
      '   ',
      'intercom.onekey.so',
      'http://intercom-preview.onekey.test/',
      'http://192.168.1.2:5173/',
      'http://10.0.2.2:5173/',
      'http://localhost.evil.test/',
      'http://127.0.0.1.evil.test/',
      'data:text/html,support',
      'file:///tmp/support.html',
    ])('rejects %p', (value) => {
      expect(normalizeIntercomSupportUrl(value)).toBeUndefined();
    });

    it('applies only while developer mode is enabled', () => {
      const settings = { intercomSupportUrl: `${PREVIEW_ORIGIN}/` };
      expect(
        resolveIntercomSupportUrlOverride({ enabled: true, settings }),
      ).toBe(`${PREVIEW_ORIGIN}/`);
      expect(
        resolveIntercomSupportUrlOverride({ enabled: false, settings }),
      ).toBeUndefined();
      expect(resolveIntercomSupportUrlOverride(undefined)).toBeUndefined();
    });

    it('derives the trusted origin from the effective support URL', () => {
      expect(
        resolveIntercomSupportOrigin({
          enabled: true,
          settings: { intercomSupportUrl: `${PREVIEW_ORIGIN}/support/` },
        }),
      ).toBe(PREVIEW_ORIGIN);
      expect(
        resolveIntercomSupportOrigin({
          enabled: true,
          settings: { intercomSupportUrl: 'not a url' },
        }),
      ).toBe(INTERCOM_SUPPORT_ORIGIN);
      expect(
        resolveIntercomSupportOrigin({
          enabled: false,
          settings: { intercomSupportUrl: `${PREVIEW_ORIGIN}/` },
        }),
      ).toBe(INTERCOM_SUPPORT_ORIGIN);
    });
  });

  describe('native handshake', () => {
    const data = JSON.stringify({ type: 'onekey-intercom-bridge', version: 1 });
    const url = `${INTERCOM_SUPPORT_URL}#bridge=injected-v1`;

    it('accepts the handshake from the support page', () => {
      expect(isIntercomNativeHandshake({ data, url })).toBe(true);
    });

    it('rejects the same handshake from any other page', () => {
      expect(
        isIntercomNativeHandshake({ data, url: 'https://evil.test/' }),
      ).toBe(false);
    });

    it('trusts only the overridden origin when one is configured', () => {
      expect(
        isIntercomNativeHandshake(
          { data, url: `${PREVIEW_ORIGIN}/#bridge=injected-v1` },
          PREVIEW_ORIGIN,
        ),
      ).toBe(true);
      expect(isIntercomNativeHandshake({ data, url }, PREVIEW_ORIGIN)).toBe(
        false,
      );
    });

    it('rejects other WebView messages', () => {
      expect(isIntercomNativeHandshake({ data: 'ready', url })).toBe(false);
      expect(isIntercomNativeHandshake({ data: '{"type":1}', url })).toBe(
        false,
      );
    });
  });
});

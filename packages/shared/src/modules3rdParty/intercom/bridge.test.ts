import { runInNewContext } from 'node:vm';

import {
  INTERCOM_SUPPORT_ORIGIN,
  createIntercomSessionMessage,
  createIntercomSessionScript,
  isIntercomBridgeHandshake,
} from './bridge';

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
});

import { runInNewContext } from 'vm';

import {
  INTERCOM_SUPPORT_ORIGIN,
  createIntercomBridgeReplyScript,
} from './bridge';

describe('Support native bridge reply', () => {
  it('delivers only in the trusted destination document', () => {
    const receive = jest.fn();
    const payload = JSON.stringify({ data: { result: 'memory-only-value' } });
    const script = createIntercomBridgeReplyScript(payload);
    runInNewContext(script, {
      window: {
        location: { origin: INTERCOM_SUPPORT_ORIGIN },
        $onekey: { jsBridge: { receive } },
      },
    });
    expect(receive).toHaveBeenCalledWith(payload);
  });

  it.each([
    'https://evil.test',
    'https://intercom.onekey.so.evil.test',
    'http://intercom.onekey.so',
    'https://intercom.onekey.so:444',
  ])('does not deliver a late response after navigation to %s', (origin) => {
    const receive = jest.fn();
    runInNewContext(createIntercomBridgeReplyScript('memory-only-value'), {
      window: { location: { origin }, $onekey: { jsBridge: { receive } } },
    });
    expect(receive).not.toHaveBeenCalled();
  });
});

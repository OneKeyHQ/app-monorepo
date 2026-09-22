const { readFileSync } = require('node:fs');
const path = require('node:path');
const { runInNewContext } = require('node:vm');

const source = readFileSync(path.join(__dirname, 'captcha.js'), 'utf8');

function loadBridge({
  native = false,
  parentOrigin = 'https://app.example.com',
} = {}) {
  const postMessage = jest.fn();
  const addEventListener = jest.fn();
  const render = jest.fn();
  const context = {
    URLSearchParams,
    location: {
      hash: `#${new URLSearchParams({
        requestId: 'test-request',
        parentOrigin,
      }).toString()}`,
    },
    window: { parent: { postMessage } },
    ...(native ? { ReactNativeWebView: { postMessage } } : {}),
    addEventListener,
    turnstile: { render },
  };
  runInNewContext(source, context);
  return { context, postMessage, addEventListener, render };
}

describe('Turnstile host bridge', () => {
  test.each([
    ['null', '*'],
    ['chrome-extension://test-extension', 'chrome-extension://test-extension'],
    ['https://app.example.com', 'https://app.example.com'],
  ])('returns a token to parent origin %s', (parentOrigin, targetOrigin) => {
    const { context, postMessage, render } = loadBridge({ parentOrigin });
    context.onCaptchaReady();
    render.mock.calls[0][1].callback('test-token');
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        requestId: 'test-request',
        status: 'success',
        token: 'test-token',
      }),
      targetOrigin,
    );
  });

  test('does not broadcast a token without a parent origin', () => {
    const { context, postMessage, render } = loadBridge({ parentOrigin: '' });
    context.onCaptchaReady();
    render.mock.calls[0][1].callback('test-token');
    expect(postMessage).not.toHaveBeenCalled();
  });

  test.each([false, true])(
    'forwards retry success with the same request on native=%s',
    (native) => {
      const { context, postMessage, render } = loadBridge({ native });
      context.onCaptchaReady();
      const options = render.mock.calls[0][1];
      // Leave recovery policy to the official client, including its Retry UI.
      expect(options.retry).toBeUndefined();
      expect(options['refresh-expired']).toBeUndefined();
      expect(options['refresh-timeout']).toBeUndefined();
      options['error-callback']();
      options['timeout-callback']();
      options.callback('test-token');
      const messages = postMessage.mock.calls.map(([message, origin]) => {
        if (native) return JSON.parse(message);
        expect(origin).toBe('https://app.example.com');
        return message;
      });
      expect(messages.map(({ status }) => status)).toEqual([
        'ready',
        'error',
        'expired',
        'success',
      ]);
      expect(
        messages.every(({ requestId }) => requestId === 'test-request'),
      ).toBe(true);
      expect(messages[3].token).toBe('test-token');
    },
  );

  test('catches a script load failure without misclassifying later provider errors', () => {
    const { context, postMessage, addEventListener } = loadBridge();
    const [event, onError, capture] = addEventListener.mock.calls[0];
    expect(event).toBe('error');
    expect(capture).toBe(true);
    onError();
    expect(postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'load-error' }),
      'https://app.example.com',
    );
    context.onCaptchaReady();
    postMessage.mockClear();
    onError();
    expect(postMessage).not.toHaveBeenCalled();
  });
});

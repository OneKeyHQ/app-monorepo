const vm = require('vm');

const {
  buildDesktopWebviewPreload,
} = require('./build-desktop-webview-preload');

const source = buildDesktopWebviewPreload('globalThis.providerLoaded = true;');
const page = 'https://login.onekeytest.com/captcha#requestId=current';

function loadPreload(url = page, isMainFrame = true) {
  const exposed = {};
  const sendToHost = jest.fn();
  const location = { href: url };
  const context = vm.createContext({
    URL,
    URLSearchParams,
    location,
    process: { isMainFrame },
    require: (name) => {
      if (name !== 'electron') throw new Error(`Unexpected import: ${name}`);
      return {
        contextBridge: {
          exposeInMainWorld: (key, value) => {
            exposed[key] = value;
          },
        },
        ipcRenderer: { sendToHost },
      };
    },
  });
  vm.runInContext(source, context);
  return { exposed, sendToHost, location, context };
}

const message = {
  type: 'onekey-test-captcha',
  requestId: 'current',
  status: 'success',
  token: 'verified-token',
};

test('the built guest preload exposes only CAPTCHA messaging on a trusted page', () => {
  const { exposed, sendToHost, context } = loadPreload();
  expect(Object.keys(exposed)).toEqual(['ReactNativeWebView']);
  expect(context.providerLoaded).toBeUndefined();
  exposed.ReactNativeWebView.postMessage(JSON.stringify(message));
  expect(sendToHost).toHaveBeenCalledWith('onekey:captcha-result', {
    url: page,
    message,
  });
});

test('invalid, oversized and stale messages cannot reach the host', () => {
  const { exposed, sendToHost, location } = loadPreload();
  const post = exposed.ReactNativeWebView.postMessage;
  post(message);
  post('invalid JSON');
  post('x'.repeat(4097));
  post(JSON.stringify({ ...message, requestId: 'stale' }));
  post(JSON.stringify({ ...message, token: '' }));
  post(JSON.stringify({ ...message, status: 'unknown' }));
  location.href = 'https://untrusted.example/captcha#requestId=current';
  post(JSON.stringify(message));
  expect(sendToHost).not.toHaveBeenCalled();
});

test.each([
  'https://login.onekeytest.com.attacker.example/captcha#requestId=current',
  'http://login.onekeytest.com/captcha#requestId=current',
  'https://login.onekeytest.com/other#requestId=current',
  'https://untrusted.example/captcha#requestId=current',
])(
  'does not expose the CAPTCHA bridge outside its exact allowlist: %s',
  (url) => {
    const { exposed, context } = loadPreload(url);
    expect(exposed).toEqual({});
    expect(context.providerLoaded).toBe(true);
  },
);

test.each([
  [page, false],
  ['https://login.onekeytest.com/captcha', true],
])(
  'does not inject either bridge into ineligible CAPTCHA documents',
  (url, main) => {
    const { exposed, context } = loadPreload(url, main);
    expect(exposed).toEqual({});
    expect(context.providerLoaded).toBeUndefined();
  },
);

test('preserves the existing provider preload on ordinary DApps', () => {
  const { context } = loadPreload('https://app.uniswap.org');
  expect(context.providerLoaded).toBe(true);
});

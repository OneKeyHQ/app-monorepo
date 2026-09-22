const params = new URLSearchParams(globalThis.location.hash.slice(1));
const requestId = params.get('requestId');
const parentOrigin = params.get('parentOrigin');
const sitekey = '0x4AAAAAAE9gPdmuh3V0hF7S';
let providerStarted = false;

function sendResult(status, token) {
  const message = { type: 'onekey-test-captcha', requestId, status, token };
  if (globalThis.ReactNativeWebView) {
    globalThis.ReactNativeWebView.postMessage(JSON.stringify(message));
  } else if (parentOrigin) {
    // Packaged desktop pages have an opaque file origin. Only their parent
    // window receives this; the host checks frame origin, source and request ID.
    window.parent.postMessage(
      message,
      parentOrigin === 'null' ? '*' : parentOrigin,
    );
  }
}

globalThis.onCaptchaReady = () => {
  if (!requestId) {
    sendResult('load-error');
    return;
  }
  globalThis.turnstile.render('#captcha', {
    sitekey,
    size: 'flexible',
    appearance: 'always',
    callback: (token) => sendResult('success', token),
    'expired-callback': () => sendResult('expired'),
    'error-callback': () => sendResult('error'),
    'timeout-callback': () => sendResult('expired'),
  });
  providerStarted = true;
  sendResult('ready');
};

// Resource errors do not bubble. Capture a blocked/unreachable SDK script too.
globalThis.addEventListener(
  'error',
  () => {
    if (!providerStarted) sendResult('load-error');
  },
  true,
);

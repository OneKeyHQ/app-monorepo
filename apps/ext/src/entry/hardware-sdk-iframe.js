import '@onekeyfe/hd-web-sdk/src/iframe';

// The host must install its bridge before the iframe's first SDK request.
// Keep the SDK's bootstrap message in an external script for extension CSP.
globalThis.parent.postMessage(
  { event: 'UI_EVENT', type: 'iframe-bootstrap' },
  globalThis.location.origin,
);

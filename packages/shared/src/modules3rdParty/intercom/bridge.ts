// The wire contract with apps/intercom/src/app-session.ts in app-webview-pages.
// The hosted page deploys separately, so changing a value here needs a new
// protocol version there first.
export const INTERCOM_SUPPORT_ORIGIN = 'https://intercom.onekey.so';
export const INTERCOM_SUPPORT_URL = `${INTERCOM_SUPPORT_ORIGIN}/`;

const SESSION_MESSAGE_TYPE = 'onekey-intercom-session';
const HANDSHAKE_MESSAGE_TYPE = 'onekey-intercom-bridge';
const BRIDGE_VERSION = 1;

export enum EIntercomBridge {
  // The native host runs window.postMessage inside the page.
  Injected = 'injected-v1',
  // The extension host answers on a port owned by the framed document.
  MessageChannel = 'message-channel-v1',
}

export type IIntercomSessionMessage = {
  type: typeof SESSION_MESSAGE_TYPE;
  version: typeof BRIDGE_VERSION;
  token?: string;
};

export const createIntercomSessionMessage = (
  token?: string,
): IIntercomSessionMessage => ({
  type: SESSION_MESSAGE_TYPE,
  version: BRIDGE_VERSION,
  ...(token ? { token } : {}),
});

// injectJavaScript targets whatever the WebView shows when it runs, so the
// script re-checks the document itself. The trailing true keeps iOS from trying
// to serialize a result.
export const createIntercomSessionScript = (token?: string): string => {
  const origin = JSON.stringify(INTERCOM_SUPPORT_ORIGIN);
  const message = JSON.stringify(createIntercomSessionMessage(token));
  return `(function () {
  if (window.top !== window.self || window.location.origin !== ${origin}) {
    return;
  }
  window.postMessage(${message}, ${origin});
})();
true;`;
};

export const isIntercomBridgeHandshake = (data: unknown): boolean => {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const { type, version } = data as { type?: unknown; version?: unknown };
  return type === HANDSHAKE_MESSAGE_TYPE && version === BRIDGE_VERSION;
};

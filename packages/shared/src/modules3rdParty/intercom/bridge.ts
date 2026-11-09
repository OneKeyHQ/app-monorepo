// The wire contract with apps/intercom/src/app-session.ts in app-webview-pages.
// The hosted page deploys separately, so changing a value here needs a new
// protocol version there first.
export const INTERCOM_SUPPORT_ORIGIN = 'https://intercom.onekey.so';
export const INTERCOM_SUPPORT_URL = `${INTERCOM_SUPPORT_ORIGIN}/`;

const isLoopbackHostname = (hostname: string): boolean =>
  hostname === 'localhost' ||
  hostname === '[::1]' ||
  /^127(\.\d{1,3}){3}$/.test(hostname);

// Dev settings can point support at another deploy of the hosted page (a
// preview or a local server). The page receives the user's session JWT, so it
// must be HTTPS; plain HTTP is only accepted on loopback, where the traffic
// never reaches the network. Anything else is ignored so a typo falls back to
// production instead of exposing the session.
export const normalizeIntercomSupportUrl = (
  value: string | undefined,
): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const url = new URL(trimmed);
    const isSecure =
      url.protocol === 'https:' ||
      (url.protocol === 'http:' && isLoopbackHostname(url.hostname));
    if (!isSecure) {
      return undefined;
    }
    // buildIntercomUrl appends the bridge fragment itself.
    url.hash = '';
    return url.href;
  } catch {
    return undefined;
  }
};

export type IIntercomSupportUrlDevSettings = {
  enabled?: boolean;
  settings?: { intercomSupportUrl?: string };
};

// The override only counts while developer mode is on, so turning developer
// mode off always restores the production page and its origin checks.
export const resolveIntercomSupportUrlOverride = (
  devSettings: IIntercomSupportUrlDevSettings | undefined,
): string | undefined =>
  devSettings?.enabled
    ? normalizeIntercomSupportUrl(devSettings.settings?.intercomSupportUrl)
    : undefined;

export const resolveIntercomSupportOrigin = (
  devSettings: IIntercomSupportUrlDevSettings | undefined,
): string => {
  const overrideUrl = resolveIntercomSupportUrlOverride(devSettings);
  return overrideUrl ? new URL(overrideUrl).origin : INTERCOM_SUPPORT_ORIGIN;
};

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
export const createIntercomSessionScript = (
  token?: string,
  supportOrigin: string = INTERCOM_SUPPORT_ORIGIN,
): string => {
  const origin = JSON.stringify(supportOrigin);
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

// Only the page knows when its listener exists, so native hosts wait for this
// instead of pushing on load, which can land before the listener is attached.
// It does not authenticate the sender: on Android WebViews without
// WEB_MESSAGE_LISTENER, messages from any frame carry the top-level URL. A
// handshake only triggers delivery; createIntercomSessionScript decides which
// document receives the session.
export const isIntercomNativeHandshake = (
  {
    data,
    url,
  }: {
    data: string;
    url: string;
  },
  supportOrigin: string = INTERCOM_SUPPORT_ORIGIN,
): boolean => {
  try {
    return (
      new URL(url).origin === supportOrigin &&
      isIntercomBridgeHandshake(JSON.parse(data))
    );
  } catch {
    return false;
  }
};

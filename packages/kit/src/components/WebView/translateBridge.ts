export const TRANSLATE_REQUEST_TYPE = '$$ONEKEY_TRANSLATE_REQUEST';
export const TRANSLATE_RESPONSE_TYPE = '$$ONEKEY_TRANSLATE_RESPONSE';
export const TRANSLATE_COMMAND_TYPE = '$$ONEKEY_TRANSLATE_COMMAND';
export const TRANSLATE_REQUEST_CHECK_TYPE = '$$ONEKEY_TRANSLATE_REQUEST_CHECK';
export const TRANSLATE_CONSOLE_PREFIX = '$$ONEKEY_TRANSLATE:';
const TRANSLATE_MARKER = '$$ONEKEY_TRANSLATE';

export type ITranslateRequest = {
  type: typeof TRANSLATE_REQUEST_TYPE;
  id: string;
  sessionId?: string;
  texts: string[];
  sourceLang: string;
  targetLang: string;
};

export type ITranslateRequestCheck = {
  type: typeof TRANSLATE_REQUEST_CHECK_TYPE;
  id: string;
  pending: boolean;
};

export type ITranslateMessage = ITranslateRequest | ITranslateRequestCheck;

type ITranslateHandler = (data: ITranslateMessage) => void;

const handlers: Record<string, ITranslateHandler> = {};

export function registerTranslateHandler(
  tabId: string,
  handler: ITranslateHandler,
) {
  handlers[tabId] = handler;
}

export function unregisterTranslateHandler(tabId: string) {
  delete handlers[tabId];
}

function dispatchTranslateMessage(tabId: string, data: ITranslateMessage) {
  handlers[tabId]?.(data);
}

type INavigationCallback = () => void;

function createTabCallbackRegistry() {
  const registry: Record<string, INavigationCallback> = {};
  return {
    on: (tabId: string, cb: INavigationCallback) => {
      registry[tabId] = cb;
    },
    off: (tabId: string) => {
      delete registry[tabId];
    },
    notify: (tabId: string) => {
      registry[tabId]?.();
    },
  };
}

const navRegistry = createTabCallbackRegistry();
export const onTabNavigation = navRegistry.on;
export const offTabNavigation = navRegistry.off;
export const notifyTabNavigation = navRegistry.notify;

const navEndRegistry = createTabCallbackRegistry();
export const onTabNavigationEnd = navEndRegistry.on;
export const offTabNavigationEnd = navEndRegistry.off;
export const notifyTabNavigationEnd = navEndRegistry.notify;

export function tryDispatchTranslateMessage(
  tabId: string,
  rawData: string,
): boolean {
  if (typeof rawData !== 'string' || !rawData.includes(TRANSLATE_MARKER))
    return false;
  try {
    const data = JSON.parse(rawData) as Record<string, unknown>;
    if (
      data?.type === TRANSLATE_REQUEST_TYPE &&
      typeof data.id === 'string' &&
      Array.isArray(data.texts)
    ) {
      dispatchTranslateMessage(tabId, data as unknown as ITranslateRequest);
      return true;
    }
    if (
      data?.type === TRANSLATE_REQUEST_CHECK_TYPE &&
      typeof data.id === 'string' &&
      typeof data.pending === 'boolean'
    ) {
      dispatchTranslateMessage(tabId, data as ITranslateRequestCheck);
      return true;
    }
  } catch {
    // ignore non-translate messages
  }
  return false;
}

// Runs in the current document, including a replacement document where the
// translator is absent. Never infer document lifetime from its URL or sid.
export function createTranslateRequestCheckScript({
  checkId,
  requestId,
  sessionId,
}: {
  checkId: string;
  requestId: string;
  sessionId?: string;
}) {
  return `
    (function() {
      const translator = globalThis.__onekeyTranslate;
      const response = JSON.stringify({
        type: ${JSON.stringify(TRANSLATE_REQUEST_CHECK_TYPE)},
        id: ${JSON.stringify(checkId)},
        pending: !!(translator && translator.isRequestPending &&
          translator.isRequestPending(${JSON.stringify(requestId)}, ${JSON.stringify(sessionId)}))
      });
      if (globalThis.ReactNativeWebView) {
        globalThis.ReactNativeWebView.postMessage(response);
      } else {
        console.log(${JSON.stringify(TRANSLATE_CONSOLE_PREFIX)} + response);
      }
    })();
    true;
  `;
}

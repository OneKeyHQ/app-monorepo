export const TRANSLATE_REQUEST_TYPE = '$$ONEKEY_TRANSLATE_REQUEST';
export const TRANSLATE_RESPONSE_TYPE = '$$ONEKEY_TRANSLATE_RESPONSE';
export const TRANSLATE_COMMAND_TYPE = '$$ONEKEY_TRANSLATE_COMMAND';
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

type ITranslateHandler = (data: ITranslateRequest) => void;

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

function dispatchTranslateMessage(tabId: string, data: ITranslateRequest) {
  handlers[tabId]?.(data);
}

type INavigationCallback = () => void;
const navigationCallbacks: Record<string, INavigationCallback> = {};

export function onTabNavigation(tabId: string, cb: INavigationCallback) {
  navigationCallbacks[tabId] = cb;
}

export function offTabNavigation(tabId: string) {
  delete navigationCallbacks[tabId];
}

export function notifyTabNavigation(tabId: string) {
  navigationCallbacks[tabId]?.();
}

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
  } catch {
    // ignore non-translate messages
  }
  return false;
}

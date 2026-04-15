import { useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ETranslateDisplayMode,
  ETranslateEngine,
} from '@onekeyhq/shared/types/discovery';

import { getWebviewWrapperRef } from '../../views/Discovery/utils/explorerUtils';

import {
  TRANSLATE_COMMAND_TYPE,
  TRANSLATE_CONSOLE_PREFIX,
  TRANSLATE_REQUEST_TYPE,
  TRANSLATE_RESPONSE_TYPE,
  offTabNavigation,
  onTabNavigation,
  registerTranslateHandler,
  unregisterTranslateHandler,
} from './translateBridge';
// @ts-expect-error text-js module imported as string by babel-plugin-inline-import / esbuild
import translateInjectScript from './translateInject.text-js';
import { createMessageInjectedScript } from './utils';

import type { ITranslateRequest } from './translateBridge';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { WebView } from 'react-native-webview';

type ITranslateResult = Array<string | null>;

type ITranslateRequestOptions = {
  onSuccess?: () => void;
  onTranslateUnavailable?: (payload: {
    code: number;
    sessionId?: string;
    targetLang: string;
  }) => void;
  testFlag?: string;
};

type ITranslateResponsePayload = {
  translations?: ITranslateResult;
  sessionId?: string;
  abort?: boolean;
};

function injectScript(tabId: string, script: string) {
  const ref = getWebviewWrapperRef(tabId);
  if (!ref) return;

  if (platformEnv.isNative) {
    try {
      (ref.innerRef as WebView)?.injectJavaScript(script);
    } catch (e) {
      console.error('[Translate] injectJavaScript error:', e);
    }
  } else if (platformEnv.isDesktop) {
    try {
      void (ref.innerRef as IElectronWebView)?.executeJavaScript(script);
    } catch (e) {
      console.error('[Translate] executeJavaScript error:', e);
    }
  }
}

async function translateTexts(
  texts: string[],
  targetLang: string,
  engine: ETranslateEngine,
  testFlag?: string,
): Promise<ITranslateResult> {
  const result = (await backgroundApiProxy.servicePrime.apiTranslate({
    texts,
    sourceLang: 'auto',
    targetLang,
    engine,
    testFlag,
  })) as
    | {
        translations?: ITranslateResult;
      }
    | undefined;
  const translations = result?.translations;
  return Array.isArray(translations) ? translations : texts;
}

function isAITranslateUnavailableError(error: unknown): error is IOneKeyError {
  const code = Number((error as IOneKeyError | undefined)?.code);
  return code === 90_104 || code === 90_105;
}

function sendTranslationResponse(
  tabId: string,
  requestId: string,
  { translations, sessionId, abort }: ITranslateResponsePayload,
) {
  const responseScript = createMessageInjectedScript({
    type: TRANSLATE_RESPONSE_TYPE,
    id: requestId,
    translations,
    sessionId,
    abort,
  });
  injectScript(tabId, responseScript);
}

function handleTranslateRequest(
  tabId: string,
  data: ITranslateRequest,
  engine: ETranslateEngine,
  {
    onSuccess,
    onTranslateUnavailable,
    testFlag,
  }: ITranslateRequestOptions = {},
): void {
  const handler = async () => {
    try {
      const translations = await translateTexts(
        data.texts,
        data.targetLang,
        engine,
        testFlag,
      );
      sendTranslationResponse(tabId, data.id, {
        translations,
        sessionId: data.sessionId,
      });
      onSuccess?.();
    } catch (err) {
      console.error('[Translate] API error:', err);
      if (
        engine === ETranslateEngine.ai &&
        isAITranslateUnavailableError(err)
      ) {
        sendTranslationResponse(tabId, data.id, {
          sessionId: data.sessionId,
          abort: true,
        });
        onTranslateUnavailable?.({
          code: Number(err.code),
          sessionId: data.sessionId,
          targetLang: data.targetLang,
        });
        return;
      }
      sendTranslationResponse(tabId, data.id, {
        translations: data.texts,
        sessionId: data.sessionId,
      });
    }
  };
  void handler();
}

let sessionCounter = 0;

function generateSessionId(): string {
  sessionCounter += 1;
  return `s${Date.now().toString(36)}${sessionCounter.toString(36)}`;
}

export function useWebViewTranslate(
  tabId: string,
  onNavigate?: () => void,
  engine: ETranslateEngine = ETranslateEngine.standard,
  displayMode: ETranslateDisplayMode = ETranslateDisplayMode.replace,
  dappUrl?: string,
  onAITranslateUnavailable?: (payload: {
    code: number;
    targetLang: string;
  }) => void,
) {
  const translatingRef = useRef(false);
  const desktopCleanupRef = useRef<(() => void) | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoggedSuccessRef = useRef(false);
  const activeSessionIdRef = useRef<string | null>(null);
  const activeEngineRef = useRef(engine);
  const engineRef = useRef(engine);
  const displayModeRef = useRef(displayMode);
  const dappUrlRef = useRef(dappUrl);
  const handledUnavailableSessionRef = useRef<string | null>(null);
  engineRef.current = engine;
  displayModeRef.current = displayMode;
  dappUrlRef.current = dappUrl;

  useEffect(() => () => unregisterTranslateHandler(tabId), [tabId]);

  useEffect(() => {
    onTabNavigation(tabId, () => {
      translatingRef.current = false;
      activeSessionIdRef.current = null;
      handledUnavailableSessionRef.current = null;
      unregisterTranslateHandler(tabId);
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
      onNavigate?.();
    });
    return () => offTabNavigation(tabId);
  }, [tabId, onNavigate]);

  useEffect(
    () => () => {
      desktopCleanupRef.current?.();
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
        startTimerRef.current = null;
      }
    },
    [],
  );

  const logTranslateSuccess = useCallback(
    (targetLang: string, sessionId?: string) => {
      if (
        !hasLoggedSuccessRef.current &&
        sessionId &&
        sessionId === activeSessionIdRef.current
      ) {
        hasLoggedSuccessRef.current = true;
        defaultLogger.prime.usage.dappTranslateSuccess({
          engine: activeEngineRef.current,
          targetLang,
          displayMode: displayModeRef.current,
          dappDomain: dappUrlRef.current ?? '',
        });
      }
    },
    [],
  );

  const stopTranslate = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    injectScript(
      tabId,
      createMessageInjectedScript({
        type: TRANSLATE_COMMAND_TYPE,
        command: 'stop',
      }),
    );
    unregisterTranslateHandler(tabId);
    desktopCleanupRef.current?.();
    handledUnavailableSessionRef.current = null;
    activeSessionIdRef.current = null;
    translatingRef.current = false;
  }, [tabId]);

  const restoreOriginal = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    injectScript(
      tabId,
      createMessageInjectedScript({
        type: TRANSLATE_COMMAND_TYPE,
        command: 'restore',
      }),
    );
    unregisterTranslateHandler(tabId);
    desktopCleanupRef.current?.();
    handledUnavailableSessionRef.current = null;
    activeSessionIdRef.current = null;
    translatingRef.current = false;
  }, [tabId]);

  const handleTranslateUnavailable = useCallback(
    ({
      code,
      sessionId,
      targetLang,
    }: {
      code: number;
      sessionId?: string;
      targetLang: string;
    }) => {
      if (
        !sessionId ||
        sessionId !== activeSessionIdRef.current ||
        handledUnavailableSessionRef.current === sessionId
      ) {
        return;
      }

      handledUnavailableSessionRef.current = sessionId;
      restoreOriginal();
      onAITranslateUnavailable?.({
        code,
        targetLang,
      });
    },
    [onAITranslateUnavailable, restoreOriginal],
  );

  const setupDesktopListener = useCallback(
    (
      selectedEngine: ETranslateEngine = engineRef.current,
      testFlag?: string,
    ) => {
      if (!platformEnv.isDesktop) return;
      desktopCleanupRef.current?.();

      const ref = getWebviewWrapperRef(tabId);
      if (!ref?.innerRef) return;

      const webview = ref.innerRef as IElectronWebView;
      const handleConsoleMessage = (event: { message: string }) => {
        if (
          typeof event.message === 'string' &&
          event.message.startsWith(TRANSLATE_CONSOLE_PREFIX)
        ) {
          try {
            const data = JSON.parse(
              event.message.slice(TRANSLATE_CONSOLE_PREFIX.length),
            ) as ITranslateRequest;
            if (data.type === TRANSLATE_REQUEST_TYPE) {
              handleTranslateRequest(tabId, data, selectedEngine, {
                onSuccess: () =>
                  logTranslateSuccess(data.targetLang, data.sessionId),
                onTranslateUnavailable: handleTranslateUnavailable,
                testFlag,
              });
            }
          } catch {
            // ignore parse errors
          }
        }
      };

      webview.addEventListener(
        'console-message',
        handleConsoleMessage as never,
      );
      desktopCleanupRef.current = () => {
        webview.removeEventListener(
          'console-message',
          handleConsoleMessage as never,
        );
        desktopCleanupRef.current = null;
      };
    },
    [tabId, logTranslateSuccess, handleTranslateUnavailable],
  );

  const ensureInjected = useCallback(
    (
      selectedEngine: ETranslateEngine = engineRef.current,
      testFlag?: string,
    ) => {
      injectScript(tabId, translateInjectScript);
      setupDesktopListener(selectedEngine, testFlag);
    },
    [tabId, setupDesktopListener],
  );

  const startTranslate = useCallback(
    (
      targetLang = 'zh',
      selectedEngine: ETranslateEngine = engineRef.current,
      testFlag?: string,
    ) => {
      if (translatingRef.current) {
        restoreOriginal();
      }

      const sid = generateSessionId();
      activeSessionIdRef.current = sid;
      activeEngineRef.current = selectedEngine;
      handledUnavailableSessionRef.current = null;
      hasLoggedSuccessRef.current = false;

      registerTranslateHandler(tabId, (data) =>
        handleTranslateRequest(tabId, data, selectedEngine, {
          onSuccess: () => logTranslateSuccess(data.targetLang, data.sessionId),
          onTranslateUnavailable: handleTranslateUnavailable,
          testFlag,
        }),
      );

      ensureInjected(selectedEngine, testFlag);
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
      }
      translatingRef.current = true;
      startTimerRef.current = setTimeout(() => {
        startTimerRef.current = null;
        injectScript(
          tabId,
          createMessageInjectedScript({
            type: TRANSLATE_COMMAND_TYPE,
            command: 'start',
            targetLang,
            displayMode: displayModeRef.current,
            sessionId: sid,
          }),
        );
      }, 50);
    },
    [
      tabId,
      ensureInjected,
      handleTranslateUnavailable,
      logTranslateSuccess,
      restoreOriginal,
    ],
  );

  const toggleTranslate = useCallback(
    (targetLang = 'zh') => {
      if (translatingRef.current) {
        restoreOriginal();
      } else {
        startTranslate(targetLang);
      }
    },
    [startTranslate, restoreOriginal],
  );

  return {
    startTranslate,
    stopTranslate,
    restoreOriginal,
    toggleTranslate,
    translatingRef,
  };
}

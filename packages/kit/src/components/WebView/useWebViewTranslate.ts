import { useCallback, useEffect, useRef } from 'react';

import { OneKeyError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getWebviewWrapperRef } from '../../views/Discovery/utils/explorerUtils';

import {
  TRANSLATE_CONSOLE_PREFIX,
  TRANSLATE_REQUEST_TYPE,
  TRANSLATE_RESPONSE_TYPE,
  offTabNavigation,
  onTabNavigation,
  registerTranslateHandler,
  unregisterTranslateHandler,
} from './translateBridge';
import translateInjectCode from './translateInjectCode';
import { createMessageInjectedScript } from './utils';

import type { ITranslateRequest } from './translateBridge';
import type { IElectronWebView } from '@onekeyfe/cross-inpage-provider-types';
import type { WebView } from 'react-native-webview';

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

const SEPARATOR = '\n\u200B\n'; // zero-width space as unique separator
const MAX_CHUNK_CHARS = 4500;

async function translateChunk(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  const combined = texts.join(SEPARATOR);
  const url = new URL('https://translate.googleapis.com/translate_a/single');
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'auto');
  url.searchParams.set('tl', targetLang);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', combined);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new OneKeyError(`Translate API HTTP ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data?.[0])) {
    throw new OneKeyError('Unexpected translate API response format');
  }
  const fullTranslation = (data[0] as Array<[string]>)
    .map((item) => item[0])
    .join('');
  const parts = fullTranslation.split(SEPARATOR);
  if (parts.length !== texts.length) {
    return texts;
  }
  return parts;
}

async function googleTranslate(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  const results: string[] = [];
  let chunk: string[] = [];
  let chunkLen = 0;

  for (const text of texts) {
    if (chunkLen + text.length > MAX_CHUNK_CHARS && chunk.length > 0) {
      const translated = await translateChunk(chunk, targetLang);
      results.push(...translated);
      chunk = [];
      chunkLen = 0;
    }
    chunk.push(text);
    chunkLen += text.length + SEPARATOR.length;
  }
  if (chunk.length > 0) {
    const translated = await translateChunk(chunk, targetLang);
    results.push(...translated);
  }
  return results;
}

function handleTranslateRequest(tabId: string, data: ITranslateRequest): void {
  const handler = async () => {
    try {
      const translations = await googleTranslate(data.texts, data.targetLang);
      sendTranslationResponse(tabId, data.id, translations);
    } catch (err) {
      console.error('[Translate] Google API error:', err);
      sendTranslationResponse(tabId, data.id, data.texts);
    }
  };
  void handler();
}

function sendTranslationResponse(
  tabId: string,
  requestId: string,
  translations: string[],
) {
  const responseScript = createMessageInjectedScript({
    type: TRANSLATE_RESPONSE_TYPE,
    id: requestId,
    translations,
  });
  injectScript(tabId, responseScript);
}

export function useWebViewTranslate(tabId: string, onNavigate?: () => void) {
  const translatingRef = useRef(false);
  const desktopCleanupRef = useRef<(() => void) | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => unregisterTranslateHandler(tabId), [tabId]);

  // Unregister handler on navigation so new pages can't trigger translate without user action
  useEffect(() => {
    onTabNavigation(tabId, () => {
      translatingRef.current = false;
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
    },
    [],
  );

  const setupDesktopListener = useCallback(() => {
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
            handleTranslateRequest(tabId, data);
          }
        } catch {
          // ignore parse errors
        }
      }
    };

    webview.addEventListener('console-message', handleConsoleMessage as never);
    desktopCleanupRef.current = () => {
      webview.removeEventListener(
        'console-message',
        handleConsoleMessage as never,
      );
      desktopCleanupRef.current = null;
    };
  }, [tabId]);

  const ensureInjected = useCallback(() => {
    // Re-injection is needed after page navigation clears the old context;
    // the script has an idempotency guard for same-page calls.
    injectScript(tabId, translateInjectCode);
    setupDesktopListener();
  }, [tabId, setupDesktopListener]);

  const startTranslate = useCallback(
    (targetLang = 'zh') => {
      registerTranslateHandler(tabId, (data) =>
        handleTranslateRequest(tabId, data),
      );
      ensureInjected();
      if (startTimerRef.current) {
        clearTimeout(startTimerRef.current);
      }
      startTimerRef.current = setTimeout(() => {
        startTimerRef.current = null;
        injectScript(
          tabId,
          `(function(){ if(window.__onekeyTranslate) window.__onekeyTranslate.start(${JSON.stringify(targetLang)}); })();`,
        );
        translatingRef.current = true;
      }, 50);
    },
    [tabId, ensureInjected],
  );

  const stopTranslate = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    injectScript(
      tabId,
      '(function(){ if(window.__onekeyTranslate) window.__onekeyTranslate.stop(); })();',
    );
    unregisterTranslateHandler(tabId);
    translatingRef.current = false;
  }, [tabId]);

  const restoreOriginal = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    injectScript(
      tabId,
      '(function(){ if(window.__onekeyTranslate) window.__onekeyTranslate.restore(); })();',
    );
    unregisterTranslateHandler(tabId);
    desktopCleanupRef.current?.();
    translatingRef.current = false;
  }, [tabId]);

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

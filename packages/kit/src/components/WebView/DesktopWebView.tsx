/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/ban-ts-comment, @typescript-eslint/no-explicit-any, react/no-unknown-property */
import type {
  ComponentProps,
  PointerEvent as ReactPointerEvent,
  Ref,
} from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { consts } from '@onekeyfe/cross-inpage-provider-core';
import { JsBridgeDesktopHost } from '@onekeyfe/onekey-cross-webview';

import { Icon, Stack, useTheme } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useDevSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { waitForDataLoaded } from '@onekeyhq/shared/src/background/backgroundUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import {
  checkOneKeyCardGoogleOauthUrl,
  needEraseElectronFeatureUrl,
} from '@onekeyhq/shared/src/utils/uriUtils';

import {
  CUSTOM_INJECTION_AUTO_REVIEW_CONFIG_CHANNEL,
  CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL,
  CUSTOM_INJECTION_RECORDING_COMMAND_CHANNEL,
  CUSTOM_INJECTION_RECORDING_EVENT_CHANNEL,
} from './customInjectionChannels';
import ErrorView from './ErrorView';
import { WEBVIEW_LOAD_TIMEOUT_MS, createMessageInjectedScript } from './utils';

import type {
  ICustomInjectionAutoReviewDetection,
  ICustomInjectionRecordingEvent,
  IElectronWebView,
  IElectronWebViewEvents,
  IInpageProviderWebViewProps,
  IWebViewRef,
} from './types';
import type { JsBridgeBase } from '@onekeyfe/cross-inpage-provider-core';
import type { IWebViewWrapperRef } from '@onekeyfe/onekey-cross-webview';
import type {
  DidFailLoadEvent,
  DidRedirectNavigationEvent,
  DidStartNavigationEvent,
  Event,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
} from 'electron';

export type {
  DidFailLoadEvent,
  DidRedirectNavigationEvent,
  DidStartNavigationEvent,
  Event,
  PageFaviconUpdatedEvent,
  PageTitleUpdatedEvent,
};

const isDev = process.env.NODE_ENV !== 'production';
type IDesktopDidFailLoadEvent = DidFailLoadEvent & {
  url?: string;
};
type IDevToolsButtonPosition = {
  xRatio: number;
  yRatio: number;
};
type IDevToolsButtonDragState = {
  containerLeft: number;
  containerTop: number;
  maxX: number;
  maxY: number;
  offsetX: number;
  offsetY: number;
  pointerId: number;
  startClientX: number;
  startClientY: number;
};
type ICustomInjectionAutoReviewPayload = {
  version: 1;
  token: string;
  detection: ICustomInjectionAutoReviewDetection;
};
type ICustomInjectionRecordingPayload =
  | {
      version: 1;
      token: string;
      status: 'started';
    }
  | {
      version: 1;
      token: string;
      status: 'completed';
      recording: unknown;
    }
  | {
      version: 1;
      token: string;
      status: 'error';
      error: string;
    };

function parseCustomInjectionAutoReviewPayload(
  value: unknown,
): ICustomInjectionAutoReviewPayload | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const payload = value as Partial<ICustomInjectionAutoReviewPayload>;
  const detection = payload.detection;
  const walletIdDetection = detection?.sourceKind === 'wallet-id';
  if (
    payload.version !== 1 ||
    typeof payload.token !== 'string' ||
    payload.token.length < 16 ||
    payload.token.length > 128 ||
    !detection ||
    typeof detection.iconKey !== 'string' ||
    !/^[a-z0-9-]{1,40}$/.test(detection.iconKey) ||
    typeof detection.iconLabel !== 'string' ||
    !/^OneKey(?:\s*&\s*.+)?$/.test(detection.iconLabel) ||
    (detection.sourceKind !== 'asset' &&
      detection.sourceKind !== 'inline' &&
      !walletIdDetection) ||
    (walletIdDetection &&
      (typeof detection.walletId !== 'string' ||
        !/^[a-z0-9]+-onekey-[a-z0-9-]+$/.test(detection.walletId))) ||
    (!walletIdDetection && detection.walletId !== undefined)
  ) {
    return undefined;
  }
  return payload as ICustomInjectionAutoReviewPayload;
}

function parseCustomInjectionRecordingPayload(
  value: unknown,
): ICustomInjectionRecordingPayload | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const payload = value as Partial<ICustomInjectionRecordingPayload>;
  if (
    payload.version !== 1 ||
    typeof payload.token !== 'string' ||
    payload.token.length < 16 ||
    payload.token.length > 128
  ) {
    return undefined;
  }
  if (payload.status === 'started') {
    return payload as ICustomInjectionRecordingPayload;
  }
  if (payload.status === 'error') {
    if (
      typeof payload.error !== 'string' ||
      !payload.error ||
      payload.error.length > 1000
    ) {
      return undefined;
    }
    return payload as ICustomInjectionRecordingPayload;
  }
  if (payload.status === 'completed') {
    if (!payload.recording || typeof payload.recording !== 'object') {
      return undefined;
    }
    try {
      if (JSON.stringify(payload.recording).length > 1024 * 1024) {
        return undefined;
      }
    } catch {
      return undefined;
    }
    return payload as ICustomInjectionRecordingPayload;
  }
  return undefined;
}

let preloadJsUrl = '';
let preloadJsUrlPromise: Promise<string> | undefined;
const preloadJsUrlListeners = new Set<() => void>();
let sharedDevToolsButtonPosition: IDevToolsButtonPosition | undefined;
let sharedDevToolsVisibility: boolean | undefined;
const sharedDevToolsButtonPositionListeners = new Set<() => void>();

function emitPreloadJsUrlChange() {
  preloadJsUrlListeners.forEach((listener) => {
    listener();
  });
}

function subscribePreloadJsUrl(listener: () => void) {
  preloadJsUrlListeners.add(listener);
  return () => {
    preloadJsUrlListeners.delete(listener);
  };
}

function getPreloadJsUrlSnapshot() {
  return preloadJsUrl;
}

function subscribeSharedDevToolsButtonPosition(listener: () => void) {
  sharedDevToolsButtonPositionListeners.add(listener);
  return () => {
    sharedDevToolsButtonPositionListeners.delete(listener);
  };
}

function getSharedDevToolsButtonPositionSnapshot() {
  return sharedDevToolsButtonPosition;
}

function setSharedDevToolsButtonPosition(
  position: IDevToolsButtonPosition | undefined,
) {
  sharedDevToolsButtonPosition = position;
  sharedDevToolsButtonPositionListeners.forEach((listener) => {
    listener();
  });
}

function getPreloadJsUrl() {
  if (preloadJsUrl) {
    return Promise.resolve(preloadJsUrl);
  }
  preloadJsUrlPromise ??= globalThis.desktopApiProxy.webview
    .getPreloadJsContent()
    .then((url: string) => {
      preloadJsUrl = url;
      emitPreloadJsUrlChange();
      return url;
    })
    .catch((error: unknown) => {
      preloadJsUrlPromise = undefined;
      throw error;
    });
  return preloadJsUrlPromise;
}

// Used for webview type referencing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const WEBVIEW_TAG = 'webview';

const DesktopWebView = forwardRef(
  (
    {
      src,
      style,
      receiveHandler,
      allowpopups,
      disableBridge,
      partition: partitionProp,
      desktopPreloadUrl,
      onCustomInjectionAutoReview,
      customInjectionRecordingCommand,
      onCustomInjectionRecordingEvent,
      onDidStartLoading,
      onDidStartNavigation,
      onDidRedirectNavigation,
      onDidFinishLoad,
      onDidStopLoading,
      onDidFailLoad,
      onPageTitleUpdated,
      onPageFaviconUpdated,
      onLoadEnd,
      // @ts-expect-error
      onNewWindow,
      onDomReady,
      onShouldStartLoadWithRequest,
      ...props
    }: ComponentProps<typeof WEBVIEW_TAG> &
      IElectronWebViewEvents &
      IInpageProviderWebViewProps,
    ref: any,
  ) => {
    const [isWebviewReady, setIsWebviewReady] = useState(false);
    const [isDomReady, setIsDomReady] = useState(false);
    // Parents hold wrapper closures across renders, so dom-ready must be read
    // from a ref, not a render snapshot.
    const isDomReadyRef = useRef(false);
    const updateIsDomReady = useCallback((value: boolean) => {
      isDomReadyRef.current = value;
      setIsDomReady(value);
    }, []);
    const webviewRef = useRef<IElectronWebView | null>(null);
    const pendingScriptsRef = useRef<string[]>([]);
    const customInjectionAutoReviewTokenRef = useRef<string | undefined>(
      undefined,
    );
    const customInjectionRecordingCommandRef = useRef<string | undefined>(
      undefined,
    );
    const devToolsButtonPosition = useSyncExternalStore(
      subscribeSharedDevToolsButtonPosition,
      getSharedDevToolsButtonPositionSnapshot,
      getSharedDevToolsButtonPositionSnapshot,
    );
    const devToolsButtonDragRef = useRef<IDevToolsButtonDragState | null>(null);
    const devToolsButtonDidDragRef = useRef(false);
    const devToolsButtonFeedbackTimerRef = useRef<ReturnType<
      typeof setTimeout
    > | null>(null);
    const [isDevToolsButtonFeedbackActive, setIsDevToolsButtonFeedbackActive] =
      useState(false);
    const [devSettings] = useDevSettingsPersistAtom();
    const theme = useTheme();
    const showWebviewDevTools = Boolean(
      devSettings.enabled && devSettings.settings?.showWebviewDevTools,
    );
    const isUnmountingRef = useRef(false);
    const resolvedPreloadJsUrl = useSyncExternalStore(
      subscribePreloadJsUrl,
      getPreloadJsUrlSnapshot,
      getPreloadJsUrlSnapshot,
    );
    const [preloadJsUrlError, setPreloadJsUrlError] = useState(false);
    const allowedDesktopPreloadUrl =
      devSettings.enabled &&
      devSettings.settings?.customInjection?.enabled === true
        ? desktopPreloadUrl
        : undefined;
    const effectivePreloadJsUrl =
      allowedDesktopPreloadUrl || resolvedPreloadJsUrl;
    const customInjectionAutoReviewEnabled = Boolean(
      !disableBridge &&
      devSettings.enabled &&
      devSettings.settings?.customInjection?.enabled &&
      allowedDesktopPreloadUrl &&
      onCustomInjectionAutoReview,
    );
    const customInjectionRecordingEnabled = Boolean(
      !disableBridge &&
      devSettings.enabled &&
      devSettings.settings?.customInjection?.enabled &&
      allowedDesktopPreloadUrl &&
      customInjectionRecordingCommand &&
      onCustomInjectionRecordingEvent,
    );

    useEffect(() => {
      if (isDev && allowedDesktopPreloadUrl) {
        console.warn(
          'DesktopWebView: using a confirmed developer preload override',
        );
      }
    }, [allowedDesktopPreloadUrl]);

    const [desktopLoadError, setDesktopLoadError] = useState(false);
    const [desktopLoadErrorCode, setDesktopLoadErrorCode] = useState<number>();
    const lastMainFrameLoadErrorRef = useRef<
      | {
          url?: string;
          errorCode?: number;
          errorDescription?: string;
        }
      | undefined
    >(undefined);
    const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearLoadTimeout = useCallback(() => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    }, []);

    const startLoadTimeout = useCallback(() => {
      clearLoadTimeout();
      loadTimeoutRef.current = setTimeout(() => {
        if (!isUnmountingRef.current) {
          setDesktopLoadError(true);
          setDesktopLoadErrorCode(undefined);
        }
      }, WEBVIEW_LOAD_TIMEOUT_MS);
    }, [clearLoadTimeout]);

    const flushPendingScripts = useCallback(() => {
      if (!isDomReady || !webviewRef.current) {
        return;
      }
      while (pendingScriptsRef.current.length) {
        const script = pendingScriptsRef.current.shift();
        if (!script) {
          // eslint-disable-next-line no-continue
          continue;
        }
        try {
          webviewRef.current.executeJavaScript(script);
        } catch (error) {
          console.error('DesktopWebView: failed to flush queued script', error);
        }
      }
    }, [isDomReady]);

    useEffect(() => {
      if (
        disableBridge ||
        allowedDesktopPreloadUrl ||
        preloadJsUrlError ||
        resolvedPreloadJsUrl
      ) {
        return undefined;
      }

      let isMounted = true;
      void getPreloadJsUrl()
        .then(() => undefined)
        .catch(() => {
          if (isMounted) {
            setPreloadJsUrlError(true);
          }
        });

      return () => {
        isMounted = false;
      };
    }, [
      allowedDesktopPreloadUrl,
      disableBridge,
      preloadJsUrlError,
      resolvedPreloadJsUrl,
    ]);

    useEffect(() => {
      if (resolvedPreloadJsUrl && preloadJsUrlError) {
        setPreloadJsUrlError(false);
      }
    }, [preloadJsUrlError, resolvedPreloadJsUrl]);

    // Register event listeners
    useEffect(() => {
      const webview = webviewRef.current;

      if (!webview) {
        return;
      }

      try {
        const checkGoogleOauth = (checkUrl: string) => {
          try {
            if (checkOneKeyCardGoogleOauthUrl({ url: checkUrl })) {
              const originUA = webview.getUserAgent();
              const updatedUserAgent = originUA.replace(
                / Electron\/[\d.]+/,
                '',
              );
              webview.setUserAgent(updatedUserAgent);
            }
          } catch (e) {
            // debugLogger.webview.error('handleNavigation', e);
            console.error(e);
          }
        };

        const checkEraseElectronFeature = (checkUrl: string) => {
          try {
            if (needEraseElectronFeatureUrl({ url: checkUrl })) {
              const originUA = webview.getUserAgent();
              const updatedUserAgent = originUA.replace(
                / Electron\/[\d.]+/,
                '',
              );
              webview.setUserAgent(updatedUserAgent);
            }
          } catch (e) {
            // debugLogger.webview.error('handleNavigation', e);
            console.error(e);
          }
        };

        const innerHandleDidFailLoad = (event: IDesktopDidFailLoadEvent) => {
          const failedUrl = event?.validatedURL ?? event?.url;
          if (event.isMainFrame) {
            clearLoadTimeout();
          }
          if (event.errorCode !== -3) {
            // TODO iframe error also show ErrorView
            //      testing www.163.com
            if (event.isMainFrame) {
              lastMainFrameLoadErrorRef.current = {
                url: failedUrl,
                errorCode: event.errorCode,
                errorDescription: event.errorDescription,
              };
              setDesktopLoadError(true);
              setDesktopLoadErrorCode(event.errorCode);
            }
          }
          onDidFailLoad?.(event);
        };

        const innerHandleDidStartNavigationNavigation = (
          event: DidStartNavigationEvent,
        ) => {
          const { isMainFrame, url } = event ?? {};
          if (isMainFrame && onShouldStartLoadWithRequest && url) {
            const shouldLoad = onShouldStartLoadWithRequest({
              url,
              isTopFrame: true,
            });
            if (!shouldLoad) {
              webviewRef.current?.stop();
              return;
            }
          }
          if (isMainFrame) {
            // A cross-document navigation recreates the isolated preload world.
            // Allow the active recorder command to be delivered to that new
            // document when its next dom-ready event fires.
            if (!event.isInPlace) {
              customInjectionAutoReviewTokenRef.current = undefined;
              customInjectionRecordingCommandRef.current = undefined;
              updateIsDomReady(false);
              startLoadTimeout();
            }
            lastMainFrameLoadErrorRef.current = undefined;
            setDesktopLoadError(false);
            setDesktopLoadErrorCode(undefined);
          }
          checkGoogleOauth(url);
          checkEraseElectronFeature(url);
          onDidStartNavigation?.(event);
        };

        const didFinishLoad = (e: any) => {
          clearLoadTimeout();
          if (!lastMainFrameLoadErrorRef.current) {
            setDesktopLoadError(false);
            setDesktopLoadErrorCode(undefined);
          }
          onDidFinishLoad?.();
          onLoadEnd?.(e);
        };

        const innerHandleDidStopLoading = () => {
          clearLoadTimeout();
          onDidStopLoading?.();
        };

        // Server-side HTTP redirects (302 / 301) reach the new URL through
        // `did-redirect-navigation`. Without an explicit listener the safety
        // check in `did-start-navigation` may fire too late to abort the
        // redirected request, so re-run the URL guard and stop the load if
        // the target is not allowed.
        const innerHandleDidRedirectNavigation = (
          event: DidRedirectNavigationEvent,
        ) => {
          const { isMainFrame, url } = event ?? {};
          if (
            isMainFrame &&
            onShouldStartLoadWithRequest &&
            url &&
            !onShouldStartLoadWithRequest({ url, isTopFrame: true })
          ) {
            webviewRef.current?.stop();
            return;
          }
          onDidRedirectNavigation?.(event);
        };

        webview.addEventListener('did-start-loading', onDidStartLoading);
        webview.addEventListener(
          'did-start-navigation',
          innerHandleDidStartNavigationNavigation,
        );
        webview.addEventListener(
          'did-redirect-navigation',
          innerHandleDidRedirectNavigation,
        );
        webview.addEventListener('did-finish-load', didFinishLoad);
        webview.addEventListener('did-stop-loading', innerHandleDidStopLoading);
        webview.addEventListener('did-fail-load', innerHandleDidFailLoad);
        webview.addEventListener('page-title-updated', onPageTitleUpdated);
        webview.addEventListener('page-favicon-updated', onPageFaviconUpdated);
        webview.addEventListener('new-window', onNewWindow);
        const handleDomReady = (event: Event) => {
          updateIsDomReady(true);
          onDomReady?.(event);
        };

        webview.addEventListener('dom-ready', handleDomReady);

        return () => {
          clearLoadTimeout();
          webview.removeEventListener('did-start-loading', onDidStartLoading);
          webview.removeEventListener(
            'did-start-navigation',
            innerHandleDidStartNavigationNavigation,
          );
          webview.removeEventListener(
            'did-redirect-navigation',
            innerHandleDidRedirectNavigation,
          );
          webview.removeEventListener('did-finish-load', didFinishLoad);
          webview.removeEventListener(
            'did-stop-loading',
            innerHandleDidStopLoading,
          );
          webview.removeEventListener('did-fail-load', innerHandleDidFailLoad);
          webview.removeEventListener('page-title-updated', onPageTitleUpdated);
          webview.removeEventListener(
            'page-favicon-updated',
            onPageFaviconUpdated,
          );
          webview.removeEventListener('new-window', onNewWindow);
          webview.removeEventListener('dom-ready', handleDomReady);
        };
      } catch (error) {
        console.error(error);
      }
    }, [
      // the first run can precede <webview> mount when the preload URL
      // resolves async, leaving every load listener unregistered.
      isWebviewReady,
      clearLoadTimeout,
      startLoadTimeout,
      updateIsDomReady,
      onDidFailLoad,
      onDidFinishLoad,
      onDidStartLoading,
      onDidStopLoading,
      onDomReady,
      onNewWindow,
      onPageFaviconUpdated,
      onPageTitleUpdated,
      onDidStartNavigation,
      onDidRedirectNavigation,
      onLoadEnd,
      onShouldStartLoadWithRequest,
    ]);
    useEffect(
      () => () => {
        isUnmountingRef.current = true;
        clearLoadTimeout();
        if (devToolsButtonFeedbackTimerRef.current) {
          clearTimeout(devToolsButtonFeedbackTimerRef.current);
        }
        // not working, ref is null after unmount
        webviewRef.current?.closeDevTools();
      },
      [clearLoadTimeout],
    );

    // TODO extract to hooks
    const jsBridgeHost = useMemo(() => {
      const b = new JsBridgeDesktopHost({
        webviewRef,
        receiveHandler,
      });
      if (process.env.NODE_ENV !== 'production') {
        // @ts-ignore
        b.$$devInstanceUUID = stringUtils.generateUUID();
      }
      return b;
    }, [receiveHandler]);

    useImperativeHandle(
      ref as Ref<unknown>,
      (): IWebViewWrapperRef => {
        const wrapper = {
          // deferred preload mounts the node after the first create; the
          // isWebviewReady dep re-snapshots innerRef once it exists.
          innerRef: isWebviewReady ? webviewRef.current : null,
          jsBridge: jsBridgeHost,
          reload: () => {
            webviewRef.current?.reload();
          },
          loadURL: (url: string) => {
            if (webviewRef.current && url) {
              webviewRef.current.loadURL(url);
            }
          },
          sendMessageViaInjectedScript: (message: unknown) => {
            const script = createMessageInjectedScript(message);
            if (!isDomReadyRef.current || !webviewRef.current) {
              pendingScriptsRef.current.push(script);
              if (pendingScriptsRef.current.length > 50) {
                console.warn(
                  'DesktopWebView: queued script count exceeded 50, dropping oldest entry.',
                );
                pendingScriptsRef.current.shift();
              }
              return;
            }
            if (webviewRef.current) {
              try {
                webviewRef.current.executeJavaScript(script);
              } catch (error) {
                console.error(
                  'DesktopWebView: failed to execute script',
                  error,
                );
              }
            }
          },
        };
        jsBridgeHost.webviewWrapper = wrapper;
        return wrapper as IWebViewRef;
      },
      // dom-ready is read via isDomReadyRef so a parent holding an old
      // wrapper still delivers.
      [isWebviewReady, jsBridgeHost],
    );

    const initWebviewByRef = useCallback(
      ($ref: any) => {
        webviewRef.current = $ref;
        updateIsDomReady(false);
        setIsWebviewReady(Boolean($ref));
      },
      [updateIsDomReady],
    );

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isWebviewReady || !customInjectionAutoReviewEnabled) {
        customInjectionAutoReviewTokenRef.current = undefined;
        return;
      }

      const configureAutoReview = () => {
        const currentUrl = webview.getURL() || webview.src || src;
        try {
          if (
            !currentUrl ||
            !src ||
            new URL(currentUrl).hostname.toLowerCase() !==
              new URL(src).hostname.toLowerCase()
          ) {
            customInjectionAutoReviewTokenRef.current = undefined;
            return;
          }
        } catch {
          customInjectionAutoReviewTokenRef.current = undefined;
          return;
        }
        const token = stringUtils.generateUUID();
        customInjectionAutoReviewTokenRef.current = token;
        try {
          void webview
            .send(CUSTOM_INJECTION_AUTO_REVIEW_CONFIG_CHANNEL, {
              version: 1,
              token,
            })
            .catch(() => {
              if (customInjectionAutoReviewTokenRef.current === token) {
                customInjectionAutoReviewTokenRef.current = undefined;
              }
            });
        } catch {
          if (customInjectionAutoReviewTokenRef.current === token) {
            customInjectionAutoReviewTokenRef.current = undefined;
          }
        }
      };

      webview.addEventListener('dom-ready', configureAutoReview);
      if (isDomReadyRef.current) {
        configureAutoReview();
      }
      return () => {
        customInjectionAutoReviewTokenRef.current = undefined;
        webview.removeEventListener('dom-ready', configureAutoReview);
      };
    }, [
      customInjectionAutoReviewEnabled,
      isWebviewReady,
      onCustomInjectionAutoReview,
      src,
    ]);

    useEffect(() => {
      const webview = webviewRef.current;
      if (
        !webview ||
        !isWebviewReady ||
        !customInjectionRecordingEnabled ||
        !customInjectionRecordingCommand
      ) {
        if (!customInjectionRecordingEnabled) {
          customInjectionRecordingCommandRef.current = undefined;
        }
        return;
      }

      const sendRecordingCommand = () => {
        const commandKey = `${customInjectionRecordingCommand.token}:${customInjectionRecordingCommand.action}`;
        if (customInjectionRecordingCommandRef.current === commandKey) {
          return;
        }
        customInjectionRecordingCommandRef.current = commandKey;
        try {
          void webview
            .send(CUSTOM_INJECTION_RECORDING_COMMAND_CHANNEL, {
              version: 1,
              token: customInjectionRecordingCommand.token,
              action: customInjectionRecordingCommand.action,
            })
            .catch(() => {
              if (customInjectionRecordingCommandRef.current === commandKey) {
                customInjectionRecordingCommandRef.current = undefined;
              }
            });
        } catch {
          if (customInjectionRecordingCommandRef.current === commandKey) {
            customInjectionRecordingCommandRef.current = undefined;
          }
        }
      };

      webview.addEventListener('dom-ready', sendRecordingCommand);
      if (isDomReadyRef.current) {
        sendRecordingCommand();
      }
      return () => {
        webview.removeEventListener('dom-ready', sendRecordingCommand);
      };
    }, [
      customInjectionRecordingCommand,
      customInjectionRecordingEnabled,
      isWebviewReady,
    ]);

    useEffect(() => {
      const webview = webviewRef.current;
      if (!webview || !isWebviewReady || disableBridge) {
        return;
      }

      // only enable message for current focused webview
      jsBridgeHost.globalOnMessageEnabled = true;
      // connect background jsBridge
      backgroundApiProxy.connectBridge(jsBridgeHost as unknown as JsBridgeBase);

      const handleMessage = async (event: {
        channel: string;
        args: unknown[];
        target: IElectronWebView;
      }) => {
        if (
          event.channel === CUSTOM_INJECTION_RECORDING_EVENT_CHANNEL &&
          customInjectionRecordingEnabled &&
          customInjectionRecordingCommand &&
          onCustomInjectionRecordingEvent
        ) {
          const payload = parseCustomInjectionRecordingPayload(event.args?.[0]);
          if (
            payload &&
            payload.token === customInjectionRecordingCommand.token
          ) {
            if (payload.status !== 'started') {
              customInjectionRecordingCommandRef.current = undefined;
            }
            const context = {
              token: payload.token,
              pageUrl: event.target.getURL() || event.target.src || src,
              webContentsId: event.target.getWebContentsId(),
            };
            if (payload.status === 'completed') {
              onCustomInjectionRecordingEvent({
                ...context,
                status: 'completed',
                recording: payload.recording,
              } as ICustomInjectionRecordingEvent);
            } else if (payload.status === 'error') {
              onCustomInjectionRecordingEvent({
                ...context,
                status: 'error',
                error: payload.error,
              });
            } else {
              onCustomInjectionRecordingEvent({
                ...context,
                status: 'started',
              });
            }
          }
          return;
        }
        if (
          event.channel === CUSTOM_INJECTION_AUTO_REVIEW_RESULT_CHANNEL &&
          customInjectionAutoReviewEnabled &&
          onCustomInjectionAutoReview
        ) {
          const payload = parseCustomInjectionAutoReviewPayload(
            event.args?.[0],
          );
          if (
            payload &&
            payload.token === customInjectionAutoReviewTokenRef.current
          ) {
            customInjectionAutoReviewTokenRef.current = undefined;
            onCustomInjectionAutoReview({
              ...payload.detection,
              pageUrl: event.target.getURL() || event.target.src || src,
              webContentsId: event.target.getWebContentsId(),
            });
          }
          return;
        }
        if (event.channel === consts.JS_BRIDGE_MESSAGE_IPC_CHANNEL) {
          const data = event?.args?.[0];
          if (typeof data !== 'string') {
            return;
          }
          let originInRequest = '';
          let origin = '';
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            originInRequest = JSON.parse(data)?.origin as string;
            await waitForDataLoaded({
              wait: 600,
              logName: 'DesktopWebView waitForDataLoaded if origin matched',
              timeout: 5000,
              data: () => {
                let originInUrl = '';
                // url initial value is empty after webview mounted first time
                const url1 = event.target.getURL(); // url won't update immediately when goForward or goBack
                const url2 = event.target.src;
                const url3 = src;
                const url = url1 || url2 || url3;
                if (url) {
                  try {
                    const uri = new URL(url);
                    originInUrl = uri?.origin || '';
                  } catch {
                    // noop
                  }
                }
                if (
                  originInUrl &&
                  originInRequest &&
                  originInUrl === originInRequest
                ) {
                  origin = originInRequest;
                  return true;
                }
                return false;
              },
            });
          } catch (_error) {
            // noop
          } finally {
            // noop
          }
          if (origin) {
            // - receive
            jsBridgeHost.receive(data, { origin });
          } else {
            // TODO log error if url is empty
          }
        }

        // response back
        // webview.send();
      };
      webview.addEventListener('ipc-message', handleMessage);
      return () => {
        webview.removeEventListener('ipc-message', handleMessage);
      };
    }, [
      customInjectionAutoReviewEnabled,
      customInjectionRecordingCommand,
      customInjectionRecordingEnabled,
      disableBridge,
      isWebviewReady,
      jsBridgeHost,
      onCustomInjectionAutoReview,
      onCustomInjectionRecordingEvent,
      src,
    ]);

    useEffect(() => {
      flushPendingScripts();
    }, [flushPendingScripts, isWebviewReady]);

    const handleDevToolsPointerDown = useCallback(
      (event: ReactPointerEvent<HTMLButtonElement>) => {
        if (event.button !== 0) {
          return;
        }
        const button = event.currentTarget;
        const container = button.parentElement;
        if (!container) {
          return;
        }
        const buttonRect = button.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const maxX = Math.max(0, containerRect.width - buttonRect.width);
        const maxY = Math.max(0, containerRect.height - buttonRect.height);
        try {
          button.setPointerCapture(event.pointerId);
        } catch {
          return;
        }
        event.preventDefault();
        devToolsButtonDidDragRef.current = false;
        devToolsButtonDragRef.current = {
          containerLeft: containerRect.left,
          containerTop: containerRect.top,
          maxX,
          maxY,
          offsetX: event.clientX - buttonRect.left,
          offsetY: event.clientY - buttonRect.top,
          pointerId: event.pointerId,
          startClientX: event.clientX,
          startClientY: event.clientY,
        };
        setSharedDevToolsButtonPosition({
          xRatio:
            maxX > 0
              ? Math.min(
                  1,
                  Math.max(0, (buttonRect.left - containerRect.left) / maxX),
                )
              : 0,
          yRatio:
            maxY > 0
              ? Math.min(
                  1,
                  Math.max(0, (buttonRect.top - containerRect.top) / maxY),
                )
              : 0,
        });
      },
      [],
    );

    const handleDevToolsPointerMove = useCallback(
      (event: ReactPointerEvent<HTMLButtonElement>) => {
        const dragState = devToolsButtonDragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }
        if (
          Math.abs(event.clientX - dragState.startClientX) > 3 ||
          Math.abs(event.clientY - dragState.startClientY) > 3
        ) {
          devToolsButtonDidDragRef.current = true;
        }
        const x = Math.min(
          dragState.maxX,
          Math.max(
            0,
            event.clientX - dragState.containerLeft - dragState.offsetX,
          ),
        );
        const y = Math.min(
          dragState.maxY,
          Math.max(
            0,
            event.clientY - dragState.containerTop - dragState.offsetY,
          ),
        );
        setSharedDevToolsButtonPosition({
          xRatio: dragState.maxX > 0 ? x / dragState.maxX : 0,
          yRatio: dragState.maxY > 0 ? y / dragState.maxY : 0,
        });
      },
      [],
    );

    const handleDevToolsPointerEnd = useCallback(
      (event: ReactPointerEvent<HTMLButtonElement>) => {
        const dragState = devToolsButtonDragRef.current;
        if (!dragState || dragState.pointerId !== event.pointerId) {
          return;
        }
        devToolsButtonDragRef.current = null;
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          // The pointer may already have been released by Chromium.
        }
      },
      [],
    );

    const handleToggleDevTools = useCallback(() => {
      if (devToolsButtonDidDragRef.current) {
        devToolsButtonDidDragRef.current = false;
        return;
      }
      const webview = webviewRef.current;
      if (!webview) {
        return;
      }
      if (devToolsButtonFeedbackTimerRef.current) {
        clearTimeout(devToolsButtonFeedbackTimerRef.current);
      }
      setIsDevToolsButtonFeedbackActive(true);
      devToolsButtonFeedbackTimerRef.current = setTimeout(() => {
        devToolsButtonFeedbackTimerRef.current = null;
        if (!isUnmountingRef.current) {
          setIsDevToolsButtonFeedbackActive(false);
        }
      }, 160);
      void globalThis.desktopApiProxy.webview
        .toggleDevTools(
          webview.getWebContentsId(),
          devSettings.enabled === true,
        )
        .catch((error: unknown) => {
          console.error('DesktopWebView: failed to toggle DevTools', error);
        });
    }, [devSettings.enabled]);

    useEffect(() => {
      if (sharedDevToolsVisibility !== showWebviewDevTools) {
        sharedDevToolsVisibility = showWebviewDevTools;
        setSharedDevToolsButtonPosition(undefined);
      }
      devToolsButtonDragRef.current = null;
      devToolsButtonDidDragRef.current = false;
      setIsDevToolsButtonFeedbackActive(false);
      if (devToolsButtonFeedbackTimerRef.current) {
        clearTimeout(devToolsButtonFeedbackTimerRef.current);
        devToolsButtonFeedbackTimerRef.current = null;
      }
    }, [showWebviewDevTools]);

    let devToolsButtonTransform = '';
    if (devToolsButtonPosition) {
      devToolsButtonTransform = `translate(-${
        devToolsButtonPosition.xRatio * 100
      }%, -${devToolsButtonPosition.yRatio * 100}%)`;
    }
    if (isDevToolsButtonFeedbackActive) {
      devToolsButtonTransform = `${devToolsButtonTransform}${
        devToolsButtonTransform ? ' ' : ''
      }scale(0.88)`;
    }

    if (preloadJsUrlError && !disableBridge) {
      return (
        <Stack flex={1} position="relative" bg="$bgApp">
          <ErrorView
            onRefresh={() => {
              setPreloadJsUrlError(false);
            }}
          />
        </Stack>
      );
    }

    if (!effectivePreloadJsUrl && !disableBridge) {
      return null;
    }
    return (
      <Stack flex={1} position="relative" bg="$bgApp">
        {showWebviewDevTools ? (
          <button
            data-testid="webview-dev-tools"
            type="button"
            aria-label="Toggle WebView DevTools; drag to reposition"
            title="Toggle WebView DevTools; drag to reposition"
            style={{
              position: 'absolute',
              zIndex: 1,
              top: devToolsButtonPosition
                ? `${devToolsButtonPosition.yRatio * 100}%`
                : 8,
              right: devToolsButtonPosition ? undefined : 8,
              left: devToolsButtonPosition
                ? `${devToolsButtonPosition.xRatio * 100}%`
                : undefined,
              transform: devToolsButtonTransform || undefined,
              width: 26,
              height: 26,
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: theme.iconOnColor.val,
              backgroundColor: isDevToolsButtonFeedbackActive
                ? theme.bgAccentActive.val
                : theme.bgAccent.val,
              border: `1px solid ${theme.bgAccentActive.val}`,
              borderRadius: 8,
              boxShadow: isDevToolsButtonFeedbackActive
                ? `0 1px 4px ${theme.bgBackdrop.val}`
                : `0 2px 10px ${theme.bgBackdrop.val}`,
              transition:
                'transform 120ms ease, background-color 120ms ease, box-shadow 120ms ease',
              cursor: 'grab',
              userSelect: 'none',
              touchAction: 'none',
              appearance: 'none',
            }}
            onClick={handleToggleDevTools}
            onPointerDown={handleDevToolsPointerDown}
            onPointerMove={handleDevToolsPointerMove}
            onPointerUp={handleDevToolsPointerEnd}
            onPointerCancel={handleDevToolsPointerEnd}
          >
            <Icon name="BugOutline" size="$3.5" color="$iconOnColor" />
          </button>
        ) : null}
        <webview
          ref={initWebviewByRef}
          {...(disableBridge ? {} : { preload: effectivePreloadJsUrl })}
          src={src}
          partition={partitionProp ?? 'persist:onekey'}
          style={{
            'width': '100%',
            'height': '100%',
            ...style,
          }}
          // Electron interprets blinkFeatures="false" as a feature name to
          // enable, triggering a security warning (enableBlinkFeatures) without
          // actually disabling anything. Added in #4874 intending to disable
          // blink features, but the correct way is to simply omit the attribute.
          // @ts-expect-error
          nodeintegration="false"
          allowpopups={allowpopups}
          webpreferences="contextIsolation=1, nativeWindowOpen=1, sandbox=1"
          // https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/platform/runtime_enabled_features.json5
          disableblinkfeatures="Notifications"
          // mobile user-agent
          // useragent="Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1"
          {...props}
        />
        {desktopLoadError ? (
          <Stack
            position="absolute"
            top={0}
            bottom={0}
            left={0}
            right={0}
            zIndex={1}
            bg="$bgApp"
          >
            <ErrorView
              errorCode={desktopLoadErrorCode}
              onRefresh={() => {
                setDesktopLoadError(false);
                setDesktopLoadErrorCode(undefined);
                webviewRef.current?.reload();
              }}
            />
          </Stack>
        ) : null}
      </Stack>
    );
  },
);
DesktopWebView.displayName = 'DesktopWebView';

export { DesktopWebView };

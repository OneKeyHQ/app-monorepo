import { useCallback, useRef } from 'react';

import type {
  ICustomInjectionAutoReviewEvent,
  IElectronWebViewEvents,
} from '@onekeyhq/kit/src/components/WebView/types';

import type { IDevelopmentDesktopBrowserContentProps } from './developmentDesktopBrowserContentTypes';

export function useDevelopmentDesktopBrowserContent({
  id,
  props,
  tabUrl,
}: {
  id: string;
  props: IDevelopmentDesktopBrowserContentProps;
  tabUrl?: string;
}) {
  const {
    customInjectionE2EPassKey,
    customInjectionRecordingCommand,
    customInjectionUrl,
    customInjectionWebViewKey,
    desktopPreloadUrl,
    onCustomInjectionAutoReview,
    onCustomInjectionDidRedirectNavigation,
    onCustomInjectionDidStartNavigation,
    onCustomInjectionDomReady,
    onCustomInjectionNavigationSettled,
    onCustomInjectionRecordingEvent,
    partition,
  } = props;
  const effectiveUrl = customInjectionUrl || tabUrl;
  const webViewInstanceKey =
    customInjectionWebViewKey || desktopPreloadUrl || partition
      ? `custom-injected-${
          customInjectionWebViewKey || id
        }-${desktopPreloadUrl || 'default'}-${partition || 'persist:onekey'}`
      : id;
  const latestWebViewInstanceKeyRef = useRef(webViewInstanceKey);
  latestWebViewInstanceKeyRef.current = webViewInstanceKey;
  const isWebViewInstanceCurrent = useCallback(
    () => latestWebViewInstanceKeyRef.current === webViewInstanceKey,
    [webViewInstanceKey],
  );
  const handleAutoReview = useCallback(
    (event: ICustomInjectionAutoReviewEvent) =>
      onCustomInjectionAutoReview?.(
        event,
        customInjectionWebViewKey,
        customInjectionE2EPassKey,
      ),
    [
      customInjectionE2EPassKey,
      customInjectionWebViewKey,
      onCustomInjectionAutoReview,
    ],
  );
  const handleDidStartNavigation = useCallback<
    NonNullable<IElectronWebViewEvents['onDidStartNavigation']>
  >(
    (event) =>
      onCustomInjectionDidStartNavigation?.(event, customInjectionWebViewKey),
    [customInjectionWebViewKey, onCustomInjectionDidStartNavigation],
  );
  const handleDidRedirectNavigation = useCallback<
    NonNullable<IElectronWebViewEvents['onDidRedirectNavigation']>
  >(
    (event) =>
      onCustomInjectionDidRedirectNavigation?.(
        event,
        customInjectionWebViewKey,
      ),
    [customInjectionWebViewKey, onCustomInjectionDidRedirectNavigation],
  );
  const handleNavigationSettled = useCallback(
    (loaded: boolean) =>
      onCustomInjectionNavigationSettled?.(loaded, customInjectionWebViewKey),
    [customInjectionWebViewKey, onCustomInjectionNavigationSettled],
  );
  const handleDomReady = useCallback(() => {
    if (customInjectionE2EPassKey) {
      onCustomInjectionDomReady?.(
        customInjectionWebViewKey,
        customInjectionE2EPassKey,
      );
      return;
    }
    onCustomInjectionDomReady?.(customInjectionWebViewKey);
  }, [
    customInjectionE2EPassKey,
    customInjectionWebViewKey,
    onCustomInjectionDomReady,
  ]);

  return {
    effectiveUrl,
    isWebViewInstanceCurrent,
    webContentProps: {
      partition,
      desktopPreloadUrl,
      onCustomInjectionAutoReview: handleAutoReview,
      customInjectionRecordingCommand,
      onCustomInjectionRecordingEvent,
      onCustomInjectionDidStartNavigation: handleDidStartNavigation,
      onCustomInjectionDidRedirectNavigation: handleDidRedirectNavigation,
      onCustomInjectionNavigationSettled: handleNavigationSettled,
      onCustomInjectionDomReady: handleDomReady,
    },
    webViewInstanceKey,
  };
}

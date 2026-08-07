import { useMemo } from 'react';

import type { IDevelopmentDesktopWebContentProps } from './developmentDesktopWebContentTypes';
import type {
  DidRedirectNavigationEvent,
  DidStartNavigationEvent,
} from 'electron';

export function useDevelopmentDesktopWebContent(
  props: IDevelopmentDesktopWebContentProps & { id: string },
) {
  const {
    customInjectionRecordingCommand,
    desktopPreloadUrl,
    isWebViewInstanceCurrent,
    onCustomInjectionAutoReview,
    onCustomInjectionDidRedirectNavigation,
    onCustomInjectionDidStartNavigation,
    onCustomInjectionDomReady,
    onCustomInjectionNavigationSettled,
    onCustomInjectionRecordingEvent,
    partition,
  } = props;
  return useMemo(
    () => ({
      didRedirectNavigation: (event: DidRedirectNavigationEvent) =>
        onCustomInjectionDidRedirectNavigation?.(event),
      didStartNavigation: (event: DidStartNavigationEvent) =>
        onCustomInjectionDidStartNavigation?.(event),
      domReady: () => onCustomInjectionDomReady?.(),
      isCurrent: () => isWebViewInstanceCurrent?.() !== false,
      navigationSettled: (loaded: boolean) =>
        onCustomInjectionNavigationSettled?.(loaded),
      webViewKey:
        desktopPreloadUrl || partition
          ? `custom-injected-${props.id}-${desktopPreloadUrl || 'default'}-${
              partition || 'persist:onekey'
            }`
          : undefined,
      webViewProps: {
        customInjectionRecordingCommand,
        desktopPreloadUrl,
        onCustomInjectionAutoReview,
        onCustomInjectionRecordingEvent,
        partition,
      },
    }),
    [
      customInjectionRecordingCommand,
      desktopPreloadUrl,
      isWebViewInstanceCurrent,
      onCustomInjectionAutoReview,
      onCustomInjectionDidRedirectNavigation,
      onCustomInjectionDidStartNavigation,
      onCustomInjectionDomReady,
      onCustomInjectionNavigationSettled,
      onCustomInjectionRecordingEvent,
      partition,
      props.id,
    ],
  );
}

import type { IInpageProviderWebViewProps } from '@onekeyhq/kit/src/components/WebView/types';

export function getDevelopmentDesktopInpageProviderProps(props: IInpageProviderWebViewProps) {
  return {
    desktopPreloadUrl: props.desktopPreloadUrl,
    onCustomInjectionAutoReview: props.onCustomInjectionAutoReview,
    customInjectionRecordingCommand: props.customInjectionRecordingCommand,
    onCustomInjectionRecordingEvent: props.onCustomInjectionRecordingEvent,
    onDidRedirectNavigation: props.onDidRedirectNavigation,
  };
}

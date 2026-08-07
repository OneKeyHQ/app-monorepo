import type { IInpageProviderWebViewProps } from './types';

export function getDevelopmentDesktopInpageProviderProps(
  props: IInpageProviderWebViewProps,
) {
  return {
    desktopPreloadUrl: props.desktopPreloadUrl,
    onCustomInjectionAutoReview: props.onCustomInjectionAutoReview,
    customInjectionRecordingCommand: props.customInjectionRecordingCommand,
    onCustomInjectionRecordingEvent: props.onCustomInjectionRecordingEvent,
    onDidRedirectNavigation: props.onDidRedirectNavigation,
  };
}

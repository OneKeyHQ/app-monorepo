import type {
  ICustomInjectionAutoReviewEvent,
  ICustomInjectionRecordingCommand,
  ICustomInjectionRecordingEvent,
  IElectronWebViewEvents,
} from '@onekeyhq/kit/src/components/WebView/types';

export type IDevelopmentDesktopWebContentProps = {
  desktopPreloadUrl?: string;
  partition?: string;
  onCustomInjectionAutoReview?: (
    event: ICustomInjectionAutoReviewEvent,
  ) => void;
  customInjectionRecordingCommand?: ICustomInjectionRecordingCommand;
  onCustomInjectionRecordingEvent?: (
    event: ICustomInjectionRecordingEvent,
  ) => void;
  onCustomInjectionDidStartNavigation?: IElectronWebViewEvents['onDidStartNavigation'];
  onCustomInjectionDidRedirectNavigation?: IElectronWebViewEvents['onDidRedirectNavigation'];
  onCustomInjectionNavigationSettled?: (loaded: boolean) => void;
  onCustomInjectionDomReady?: () => void;
  isWebViewInstanceCurrent?: () => boolean;
};

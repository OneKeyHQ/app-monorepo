import type {
  ICustomInjectionAutoReviewEvent,
  ICustomInjectionRecordingCommand,
  ICustomInjectionRecordingEvent,
  IElectronWebViewEvents,
} from '@onekeyhq/kit/src/components/WebView/types';

export type IDevelopmentDesktopBrowserContentProps = {
  customInjectionUrl?: string;
  customInjectionWebViewKey?: string;
  desktopPreloadUrl?: string;
  onCustomInjectionAutoReview?: (
    event: ICustomInjectionAutoReviewEvent,
    instanceKey?: string,
    e2ePassKey?: string,
  ) => void;
  customInjectionE2EPassKey?: string;
  partition?: string;
  customInjectionRecordingCommand?: ICustomInjectionRecordingCommand;
  onCustomInjectionRecordingEvent?: (
    event: ICustomInjectionRecordingEvent,
  ) => void;
  onCustomInjectionDidStartNavigation?: (
    event: Parameters<
      NonNullable<IElectronWebViewEvents['onDidStartNavigation']>
    >[0],
    instanceKey?: string,
  ) => void;
  onCustomInjectionDidRedirectNavigation?: (
    event: Parameters<
      NonNullable<IElectronWebViewEvents['onDidRedirectNavigation']>
    >[0],
    instanceKey?: string,
  ) => void;
  onCustomInjectionNavigationSettled?: (
    loaded: boolean,
    instanceKey?: string,
  ) => void;
  onCustomInjectionDomReady?: (
    instanceKey?: string,
    e2ePassKey?: string,
  ) => void;
};

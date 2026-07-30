import type {
  ICustomInjectedProtocol,
  ICustomInjectedSession,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

export type ICustomInjectedToolbarProps = {
  sessionId: string;
  selectedProtocolId: string;
  activeBundleSha256: string;
  onSelectProtocol: (
    protocol: ICustomInjectedProtocol,
    customSession: ICustomInjectedSession,
  ) => void;
  onReload: (customSession: ICustomInjectedSession) => void;
};

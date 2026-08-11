import type { ICustomInjectedProtocolRuntimeScope } from '@onekeyhq/kit/src/utils/customInjectedProtocolRuntime';
import type {
  ICustomInjectedE2EAdapterControl,
  ICustomInjectedE2EStopResult,
  ICustomInjectedProtocol,
  ICustomInjectedSession,
} from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiWebview';

export type ICustomInjectedToolbarProps = {
  activeSession: ICustomInjectedSession;
  sessionId: string;
  selectedProtocolId: string;
  activeBundleSha256: string;
  getCurrentWebViewUrl: () => string | undefined;
  recordingPhase?: 'preparing' | 'recording' | 'stopping' | 'saving';
  e2eGenerating?: boolean;
  protocolRuntimeScope?: ICustomInjectedProtocolRuntimeScope;
  protocolSwitchingLocked?: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onStopE2EGeneration?: () => Promise<ICustomInjectedE2EStopResult>;
  onPrepareE2EPass: (
    adapterControl?: ICustomInjectedE2EAdapterControl,
  ) => Promise<boolean>;
  onSelectProtocol: (
    protocol: ICustomInjectedProtocol,
    customSession: ICustomInjectedSession,
  ) => void;
  onReload: (
    customSession: ICustomInjectedSession,
    expectedProtocolId: string,
  ) => void;
};

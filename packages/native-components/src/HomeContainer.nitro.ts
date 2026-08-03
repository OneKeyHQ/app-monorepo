import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules';

export interface IHomeContainerNativeProps extends HybridViewProps {
  initialStateJson: string;
  backgroundColor: string;
  debugOverlayEnabled: boolean;
  onRenderError?: (code: string, message: string) => void;
  onIntent?: (intentJson: string) => void;
}

export interface IHomeContainerNativeMethods extends HybridViewMethods {
  setState(stateJson: string): void;
  completeRefresh(requestId: string): void;
  selectTab(tabId: string, animated: boolean): void;
}

// Nitrogen autolinking requires this alias to match the registered HybridView name.
// eslint-disable-next-line @typescript-eslint/naming-convention
export type HomeContainer = HybridView<
  IHomeContainerNativeProps,
  IHomeContainerNativeMethods
>;

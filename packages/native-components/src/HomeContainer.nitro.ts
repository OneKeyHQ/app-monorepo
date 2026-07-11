import type {
  HybridView,
  HybridViewMethods,
  HybridViewProps,
} from 'react-native-nitro-modules';

export interface IHomeContainerNativeProps extends HybridViewProps {
  initialSnapshotJson: string;
  backgroundColor: string;
  debugOverlayEnabled: boolean;
  onAction?: (actionId: string, itemId: string, tabId: string) => void;
  onRefresh?: (tabId: string, requestId: string) => void;
  onVisibleTabChange?: (tabId: string) => void;
  onRenderError?: (code: string, message: string) => void;
}

export interface IHomeContainerNativeMethods extends HybridViewMethods {
  setSnapshot(snapshotJson: string): void;
  applyPatch(patchJson: string): void;
  completeRefresh(requestId: string): void;
  selectTab(tabId: string, animated: boolean): void;
  getCapabilities(): string;
}

// Nitrogen autolinking requires this alias to match the registered HybridView name.
// eslint-disable-next-line @typescript-eslint/naming-convention
export type HomeContainer = HybridView<
  IHomeContainerNativeProps,
  IHomeContainerNativeMethods
>;

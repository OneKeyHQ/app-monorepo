import type { IHomeContainerProps } from '@onekeyhq/native-components';

export interface INativeHomePageProps {
  debugOverlayEnabled?: boolean;
  onAction?: IHomeContainerProps['onAction'];
  onRenderError?: IHomeContainerProps['onRenderError'];
}

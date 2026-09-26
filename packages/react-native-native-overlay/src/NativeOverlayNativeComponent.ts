import { codegenNativeComponent } from 'react-native';

import type { ColorValue, HostComponent, ViewProps } from 'react-native';
import type {
  DirectEventHandler,
  Int32,
  WithDefault,
} from 'react-native/Libraries/Types/CodegenTypes';

type INativeOverlayDismissedEvent = Readonly<{
  reason: string;
}>;

type INativeOverlayRequestDismissEvent = Readonly<{
  reason: string;
}>;

type INativeOverlayPresentedEvent = Readonly<{
  stackOrder: Int32;
}>;

export interface INativeOverlayNativeProps extends ViewProps {
  /** Present when true; play the exit animation and emit onDismissed when it turns false. */
  visible: boolean;
  level?: WithDefault<
    'modal' | 'hardware' | 'secure' | 'toast' | 'lock' | 'debug',
    'modal'
  >;
  presentation?: WithDefault<
    'center' | 'toast' | 'fullscreen' | 'sheet' | 'anchored',
    'center'
  >;
  /** Order inside the level; higher renders above. */
  stackOrder?: WithDefault<Int32, 0>;
  /** Swallow touches that miss the content instead of passing them through. */
  blocking?: WithDefault<boolean, true>;
  dismissOnBackPress?: WithDefault<boolean, true>;
  dismissOnBackdropPress?: WithDefault<boolean, false>;
  backdropColor?: ColorValue;
  /** JSON of the resolved animation (`IResolvedOverlayAnimation`). */
  animationConfig?: WithDefault<string, ''>;
  onPresented?: DirectEventHandler<INativeOverlayPresentedEvent>;
  onDismissed?: DirectEventHandler<INativeOverlayDismissedEvent>;
  onRequestDismiss?: DirectEventHandler<INativeOverlayRequestDismissEvent>;
}

export default codegenNativeComponent<INativeOverlayNativeProps>(
  'RNCNativeOverlay',
) as HostComponent<INativeOverlayNativeProps>;

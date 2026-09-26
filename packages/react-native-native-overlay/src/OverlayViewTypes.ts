import type { ReactNode } from 'react';

import type {
  IOverlayAnimation,
  IOverlayPresentation,
} from './animation/types';
import type {
  IOverlayDismissReason,
  IOverlayLevel,
  IOverlayStrategy,
} from './types';
import type { ColorValue } from 'react-native';

export type IOverlayRequestDismissReason = 'back' | 'backdrop';

export interface IOverlayBackdrop {
  /** Include alpha; e.g. the theme `$bgBackdrop`. */
  color?: ColorValue;
  dismissOnPress?: boolean;
}

export interface IOverlayViewProps {
  /** Desired open state. The overlay may still be queued by its strategy. */
  visible: boolean;
  level?: IOverlayLevel;
  strategy?: IOverlayStrategy;
  priority?: number;
  replaceKey?: string;
  presentation?: IOverlayPresentation;
  animation?: IOverlayAnimation;
  /** `false` renders no backdrop. */
  backdrop?: IOverlayBackdrop | false;
  /** Defaults by level: toast and debug pass touches through. */
  blocking?: boolean;
  dismissOnBackPress?: boolean;
  /**
   * Back press or backdrop press asked to close. When omitted the overlay
   * closes itself; when provided the caller decides by toggling `visible`.
   */
  onRequestDismiss?: (reason: IOverlayRequestDismissReason) => void;
  onPresented?: () => void;
  /** The exit animation finished and the content unmounted. */
  onClose?: (reason: IOverlayDismissReason) => void;
  children?: ReactNode;
  testID?: string;
}

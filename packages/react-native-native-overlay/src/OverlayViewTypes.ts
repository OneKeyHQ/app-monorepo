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

export type IOverlayRequestDismissReason = 'back' | 'backdrop' | 'pan';

export interface IOverlayBackdrop {
  /** Include alpha; e.g. the theme `$bgBackdrop`. */
  color?: ColorValue;
  dismissOnPress?: boolean;
}

export interface IOverlaySheetOptions {
  /** Fixed height; when omitted the sheet fits its content. */
  height?: number;
  /** Defaults to 92% of the window height. */
  maxHeight?: number;
  cornerRadius?: number;
  showHandle?: boolean;
  backgroundColor?: ColorValue;
  /** Swipe down to close. A pan dismissal cannot be vetoed. */
  dismissOnPanDown?: boolean;
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
  /** `presentation="sheet"` only. */
  sheet?: IOverlaySheetOptions;
  /**
   * Native only: keep the content mounted (staged, invisible) while closed so
   * callers can measure it before opening, as native-sheet did.
   */
  keepContentMounted?: boolean;
  /** `false` renders no backdrop. */
  backdrop?: IOverlayBackdrop | false;
  /** Defaults by level: toast and debug pass touches through. */
  blocking?: boolean;
  dismissOnBackPress?: boolean;
  /**
   * Back press or backdrop press asked to close. When omitted the overlay
   * closes itself; when provided the caller decides by toggling `visible`.
   * A `pan` dismissal already happened natively and always closes.
   */
  onRequestDismiss?: (reason: IOverlayRequestDismissReason) => void;
  onPresented?: () => void;
  /** The exit animation finished and the content unmounted. */
  onClose?: (reason: IOverlayDismissReason) => void;
  children?: ReactNode;
  testID?: string;
}

import type { ComponentProps, ReactNode } from 'react';

import type { BottomSheet as ExpoBottomSheet } from '@expo/ui';

export interface IBottomSheetProps {
  /** Controlled visibility. There is no uncontrolled mode on purpose. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Measured content; the sheet stands at whatever height it takes. */
  children?: ReactNode;
  /**
   * Explicit rest heights — the type is the upstream prop's own, taken
   * verbatim ('half' | 'full' | fraction-of-screen | fixed height), so
   * this stays whatever expo says it is. Omitted — the default — the
   * sheet sizes itself to its content and follows it as it changes;
   * given, the caller takes the height over: the sheet rests at these
   * stops, draggable between them, and the content measurement stands
   * down.
   */
  snapPoints?: ComponentProps<typeof ExpoBottomSheet>['snapPoints'];
  /**
   * When false, the drag indicator hides and interactive dismissal is
   * disabled — closing becomes the content's job.
   */
  dismissible?: boolean;
  /**
   * Opaque paint over the whole sheet face (presentationBackground),
   * replacing the platform material. For stage-like surfaces that must not
   * sample what is behind them.
   */
  background?: string;
  /**
   * Keeps the app behind the sheet interactive instead of dimmed-and-inert
   * (iOS presentationBackgroundInteraction, 16.4+).
   */
  backgroundInteractive?: boolean;
}

/**
 * The slice of the sheet surface the demo stories exercise. Living here —
 * type-only — both platform demos share one source, and the web shell never
 * pulls @expo/ui at runtime: type imports erase at compile time.
 */
export type IBottomSheetDemoProps = Pick<
  IBottomSheetProps,
  'dismissible' | 'background' | 'backgroundInteractive' | 'snapPoints'
>;

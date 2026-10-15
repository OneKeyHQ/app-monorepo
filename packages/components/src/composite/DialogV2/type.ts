import type { ReactNode } from 'react';

/**
 * Exploration-only Dialog. A presentation shell with no content of its own:
 * no header, footer, actions or close button — children are the entire face
 * content. The web face keeps the transcribed upstream container skin
 * (backdrop, centred stock frame, its padding and type, open/close motion);
 * the native face is the bare system sheet. No imperative show(), no portal
 * targeting, no analytics, no form binding — those belong to an integration
 * layer built after this is accepted.
 */
export interface IDialogV2Props {
  /** Controlled visibility. There is no uncontrolled mode on purpose. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The entire face content. */
  children?: ReactNode;
  /**
   * When false, the escape key, the backdrop press and interactive dismissal
   * are disabled, leaving the caller's own controls as the only way out.
   */
  dismissible?: boolean;
  /**
   * Opaque paint over the whole sheet face (native presentationBackground;
   * web panel background), replacing the platform material. For stage-like
   * surfaces that must not sample what is behind them.
   */
  background?: string;
  /**
   * Keeps the app behind the sheet interactive instead of dimmed-and-inert
   * (iOS presentationBackgroundInteraction). Native only; the web dialog
   * keeps its modal backdrop.
   */
  backgroundInteractive?: boolean;
}

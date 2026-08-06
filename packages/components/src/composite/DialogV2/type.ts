import type { ReactNode } from 'react';

/**
 * Exploration-only Dialog. Deliberately minimal: it carries what is needed to
 * judge look and interaction, and nothing else. No imperative show(), no portal
 * targeting, no analytics, no form binding — those belong to an integration
 * layer built after this is accepted.
 */
export interface IDialogV2Props {
  /** Controlled visibility. There is no uncontrolled mode on purpose. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  /** Body content between the header and the footer. */
  children?: ReactNode;
  /** Tints the primary action. */
  tone?: 'default' | 'destructive';
  /** The primary action renders only when its label is provided. */
  confirmText?: string;
  onConfirm?: () => void;
  /** The secondary action renders only when its label is provided. */
  cancelText?: string;
  onCancel?: () => void;
  /**
   * When false, the escape key, the backdrop press and the close button are all
   * disabled, leaving the footer actions as the only way out.
   */
  dismissible?: boolean;
  /**
   * Opaque paint over the whole sheet face (native presentationBackground;
   * web panel background), replacing the platform material. For stage-like
   * surfaces that must not sample what is behind them.
   */
  background?: string;
}

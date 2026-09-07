import type {
  IOneKeyError,
  IOneKeyErrorI18nInfo,
} from '../src/errors/types/errorTypes';

export type IDeviceStageErrorI18n = Pick<
  IOneKeyError<IOneKeyErrorI18nInfo>,
  'key' | 'info'
>;

/**
 * DeviceStage integration-layer vocabulary (OK-59934).
 *
 * Mirrors the step union of
 * `packages/components/src/composite/DeviceStage/type.ts`. Kept in shared so
 * kit-bg (which must not import components) and kit can speak the same
 * vocabulary; the two unions are structurally identical, so values flow into
 * the component prop without casts.
 */
export type IDeviceStageStepValue =
  | 'off'
  | 'connecting'
  | 'enterPin'
  | 'pinOnApp'
  | 'passphraseIntro'
  | 'enterPassphrase'
  | 'passphraseOnApp'
  | 'showQr'
  | 'scanQr'
  | 'confirm'
  | 'genuineCheck'
  | 'authVerifying'
  | 'authSuccess'
  | 'authFailure'
  | 'processing'
  | 'error'
  | 'searching'
  | 'confirmOnDevice'
  | 'openApp'
  | 'unlockDevice'
  | 'done'
  | 'pairingCode'
  | 'deviceNotFound'
  | 'btcHighIndex'
  | 'installConfirm'
  | 'installing'
  | 'installBatch';

export type IDeviceStageErrorReasonValue =
  | 'rejected'
  | 'pinInvalid'
  | 'disconnected'
  | 'busy';

/** What ended the authenticity check. The first three are terminal (the
 * device or its firmware is the problem, Support is the only exit); the
 * last three are recoverable (Retry plus the gated Continue-anyway). */
export type IDeviceStageAuthFailureReasonValue =
  | 'unofficialDevice'
  | 'unofficialFirmware'
  | 'defective'
  | 'network'
  | 'unknown'
  | 'unavailable';

/** One row of the authenticity checklist — certificate first, then each
 * firmware component. */
export type IDeviceStageAuthChecklistItem = {
  label: string;
  status: 'pending' | 'loading' | 'ok' | 'failed';
  /** The verified result — serial or version string — shown on ok. */
  value?: string;
  /** Release page for a verified component; the value becomes a link. */
  url?: string;
};

export type IDeviceStageConfirmDetail = {
  label: string;
  value: string;
  highlightEnds?: boolean;
  warning?: boolean;
};

/**
 * The confirm card's payload, registered by the business caller that
 * initiates the hardware call — the SDK's "press the button" event carries
 * no business context, so whoever knows the transaction registers what the
 * person must check against the device. One of the three shapes.
 */
export type IDeviceStageConfirmContent = {
  /** Field rows — transfer address / amount / fee. */
  details?: IDeviceStageConfirmDetail[];
  /** Text block — the signed original of a message signature. */
  message?: string;
  /** One-line sentence for payload-less device actions. */
  description?: string;
  /** Ink the description destructive (wipe device …). */
  descriptionDanger?: boolean;
  /** Place in a run of confirmations (approve-then-swap …). */
  count?: { current: number; total: number };
};

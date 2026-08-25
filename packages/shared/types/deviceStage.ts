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

export type IDeviceStageConfirmDetail = {
  label: string;
  value: string;
  highlightEnds?: boolean;
  warning?: boolean;
};

export type EFirmwareUpdateProjectionPhase =
  | 'DISCOVERING'
  | 'PLAN_CREATED'
  | 'ELIGIBILITY_CHECKING'
  | 'ACQUIRING'
  | 'MATERIALIZING'
  | 'PREPARED'
  | 'ENTERING_LOADER'
  | 'TRANSFERRING'
  | 'INSTALLING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'PAUSED'
  | 'FAILED'
  | 'ABANDONED'
  | 'RECOVERY_UNSUPPORTED';

export type EFirmwareUpdateProjectionProgressStage =
  | 'acquisition'
  | 'materialization'
  | 'transfer'
  | 'install';

export type EFirmwareUpdateProjectionAction =
  | 'none'
  | 'awaiting-device'
  | 'confirm-on-device'
  | 'reconnect'
  | 'retry';

export type EFirmwareUpdateProjectionCancelDisposition =
  | 'none'
  | 'cancelled-before-mutation'
  | 'paused'
  | 'stop-waiting';

export type IFirmwareUpdateProjectionError = {
  name: string;
  message: string;
  code?: string | number;
  retryable?: boolean;
};

export type IFirmwareUpdateProjection = {
  sessionId: string;
  revision: number;
  phase: EFirmwareUpdateProjectionPhase;
  progress?: {
    stage: EFirmwareUpdateProjectionProgressStage;
    completed: number;
    total: number;
    artifactId?: string;
    target?:
      | 'bootloader'
      | 'firmware'
      | 'ble'
      | 'resource'
      | 'p1'
      | 'p2'
      | 'coprocessor'
      | 'se01'
      | 'se02'
      | 'se03'
      | 'se04';
  };
  action?: EFirmwareUpdateProjectionAction;
  cancelDisposition?: EFirmwareUpdateProjectionCancelDisposition;
  error?: IFirmwareUpdateProjectionError;
};

export type IFirmwareUpdateUserConfirmation = {
  backuped: boolean;
  usbConnected: boolean;
};

export type IFirmwareUpdateSessionStartInput = {
  connectId: string;
  updateType: 'firmware' | 'ble';
  channel?: 'stable' | 'pre-release';
  firmwareType?: 'universal' | 'bitcoinonly';
  confirmations: IFirmwareUpdateUserConfirmation;
};

export type IFirmwareUpdateSessionStartResult =
  | {
      engine: 'transaction';
      projection: IFirmwareUpdateProjection;
    }
  | {
      engine: 'legacy';
      reason:
        | 'rollout_not_allowed'
        | 'capability_not_ready'
        | 'sdk_managed_platform';
    };

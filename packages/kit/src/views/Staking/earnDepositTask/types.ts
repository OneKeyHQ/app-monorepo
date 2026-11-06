import type { IApproveConfirmFnParams } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';

import type { IDepositTask, IDepositTaskState } from './state';

export type IDepositTaskHandle = {
  taskState?: IDepositTaskState;
  getTask: () => IDepositTask;
  isExecutionCurrent?: () => boolean;
  run: () => Promise<void>;
  retry: () => Promise<void>;
  retryStatus: () => Promise<void>;
  retryRecording?: () => Promise<void>;
  cancel: () => void;
  dispose: () => void;
};

export type IDirectDepositTaskConfig = {
  token: IToken;
  spenderAddress: string;
  requiresAllowanceReset: boolean;
  confirmReset: (signal: AbortSignal) => Promise<boolean>;
  prepareDeposit: (
    signal: AbortSignal,
  ) => Promise<
    { type: 'confirm'; effectiveApy?: string | number } | { type: 'cancelled' }
  >;
};

export type IEarnStakeConfirmParams = IApproveConfirmFnParams & {
  taskMode?: 'deposit';
  taskAccountAddress?: string;
  resumeTaskState?: IDepositTaskState;
  directDepositTask?: IDirectDepositTaskConfig;
  prepareWrappedDeposit?: IDirectDepositTaskConfig['prepareDeposit'];
  beforeDepositTaskSend?: (
    step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
  ) => Promise<boolean>;
  canSendDepositTask?: (
    step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
  ) => boolean;
  onDepositTaskReady?: (handle: IDepositTaskHandle) => boolean | void;
  onDepositTaskChange?: (task: IDepositTask) => void;
  onDepositTaskSettled?: (taskId: string, txid: string) => void | Promise<void>;
  canRecoverDepositRecording?: () => boolean;
};

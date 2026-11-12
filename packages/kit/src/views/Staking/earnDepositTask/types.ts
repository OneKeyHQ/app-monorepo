import type { IApproveConfirmFnParams } from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import type { IDepositTask, IDepositTaskState } from './state';
import type { buildEarnStakeConfirmation } from './transactionBuilder';
import type { createEarnConfirmationTaskAdapter } from '../../Earn/tasks/confirmationTaskAdapter';
import type { IEarnTaskScope } from '../../Earn/tasks/earnTaskPlan';
import type {
  IEarnWorkflowTask,
  IEarnWorkflowTaskStep,
} from '../../Earn/tasks/earnWorkflowTaskState';

export type IStakeWorkflowIdentity = IEarnTaskScope & {
  action: 'stake';
  intent: {
    amount: string;
    symbol: string;
    inputTokenAddress: string;
    protocolVault: string;
    spenderAddress: string;
  };
};
export type IStakeWorkflowStep = Exclude<
  IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;
export type IStakeWorkflowConfirmation = ReturnType<
  typeof createEarnConfirmationTaskAdapter<
    IEarnTaskScope,
    IStakeWorkflowStep,
    Awaited<ReturnType<typeof buildEarnStakeConfirmation>>,
    ISendTxOnSuccessData[],
    Error
  >
>;
export type IStakeWorkflowHandoff = {
  register: (
    identity: IStakeWorkflowIdentity,
    confirmation: IStakeWorkflowConfirmation,
  ) => Promise<boolean>;
  readonly signal?: AbortSignal;
  accountAddress: string;
  isResultCurrent: () => boolean;
  onSubmitted: () => void;
};

export type IStakefishSignTaskConfig = {
  sign: (
    accountAddress: string,
  ) => Promise<{ signature: string; message: string } | undefined>;
  beforeDeposit: (signal: AbortSignal) => Promise<boolean>;
  isResultCurrent?: () => boolean;
  onTaskChange?: (task: IEarnWorkflowTask<IEarnTaskScope>) => void;
};

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
  allowanceVerificationMode?: 'legacy';
  confirmReset: (signal: AbortSignal) => Promise<boolean>;
  prepareDeposit: (
    signal: AbortSignal,
  ) => Promise<
    { type: 'confirm'; effectiveApy?: string | number } | { type: 'cancelled' }
  >;
};

export type IEarnStakeConfirmParams = IApproveConfirmFnParams & {
  workflowHandoff?: IStakeWorkflowHandoff;
  workflowSpenderAddress?: string;
  stakefishSignTask?: IStakefishSignTaskConfig;
  taskMode?: 'deposit';
  taskAccountAddress?: string;
  isSendCurrent?: () => boolean;
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

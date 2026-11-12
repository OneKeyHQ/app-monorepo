import { createBabylonWithdrawTask } from './babylon/withdrawTask';
import {
  createEthenaWithdrawFragment,
  runEthenaWithdrawTask,
} from './ethena/withdrawTask';
import {
  createLidoWithdrawFragment,
  createLidoWithdrawTask,
} from './lido/withdrawTask';
import {
  createStakefishWithdrawFragment,
  runStakefishWithdrawTask,
} from './stakefish/withdrawTask';
import { withdrawProtocolPlans } from './withdrawProtocol';

import type { IEthenaWithdrawContext } from './ethena/withdrawTask';
import type { ILidoWithdrawContext } from './lido/withdrawTask';
import type { IStakefishWithdrawContext } from './stakefish/withdrawTask';
import type { IEarnWithdrawTransaction } from './withdrawProtocol';

export type IUniversalWithdrawContext = ILidoWithdrawContext &
  IStakefishWithdrawContext &
  IEthenaWithdrawContext;

export type ISingleWithdrawPrepared =
  | { type: 'cancelled' }
  | { type: 'exitBroadcasted' }
  | ({ type: 'transaction' } & IEarnWithdrawTransaction);

export type IUniversalWithdrawPrepared =
  | { kind: 'single'; value: ISingleWithdrawPrepared }
  | { kind: 'protocol'; value: IEarnWithdrawTransaction };

/** Bind the selected protocol's plan to its runtime implementation. */
export const withdrawProtocolRuntime = {
  lido: {
    ...withdrawProtocolPlans.lido,
    createFragment: createLidoWithdrawFragment,
    createTask: createLidoWithdrawTask,
  },
  stakefish: {
    ...withdrawProtocolPlans.stakefish,
    createFragment: createStakefishWithdrawFragment,
    runTask: runStakefishWithdrawTask,
  },
  ethena: {
    ...withdrawProtocolPlans.ethena,
    createFragment: createEthenaWithdrawFragment,
    runTask: runEthenaWithdrawTask,
  },
  single: withdrawProtocolPlans.single,
  babylon: {
    ...withdrawProtocolPlans.babylon,
    createTask: createBabylonWithdrawTask,
  },
  signOnly: {
    ...withdrawProtocolPlans.signOnly,
    createTask: createBabylonWithdrawTask,
  },
} as const;

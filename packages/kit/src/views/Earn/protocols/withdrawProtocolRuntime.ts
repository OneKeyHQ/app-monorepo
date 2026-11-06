import { createBabylonWithdrawTask } from './babylonWithdrawTask';
import {
  createEthenaWithdrawFragment,
  runEthenaWithdrawTask,
} from './ethenaWithdrawTask';
import {
  createLidoWithdrawFragment,
  createLidoWithdrawTask,
} from './lidoWithdrawTask';
import {
  createStakefishWithdrawFragment,
  runStakefishWithdrawTask,
} from './stakefishWithdrawTask';
import { withdrawProtocolPlans } from './withdrawProtocol';

import type { IEthenaWithdrawContext } from './ethenaWithdrawTask';
import type { ILidoWithdrawContext } from './lidoWithdrawTask';
import type { IStakefishWithdrawContext } from './stakefishWithdrawTask';
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
  signOnly: withdrawProtocolPlans.signOnly,
} as const;

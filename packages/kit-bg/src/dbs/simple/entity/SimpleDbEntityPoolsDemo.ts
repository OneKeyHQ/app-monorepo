import type { IPoolPosition, IPoolTask } from '@onekeyhq/shared/types/pools';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Pools demo state: mock positions, wallet balances and multi-step tasks.
// Persisted so an unfinished Zap survives an app restart, as the product
// doc requires (§3.8).
export interface IPoolsDemoDBStruct {
  version: number;
  positions: IPoolPosition[];
  /** Human amounts keyed by pool asset id */
  balances: Record<string, string>;
  /** Granted allowances, keyed `${assetId}>${spenderName}` */
  approvals: Record<string, boolean>;
  tasks: IPoolTask[];
  nextTokenId: number;
  failNextStep: boolean;
}

export class SimpleDbEntityPoolsDemo extends SimpleDbEntityBase<IPoolsDemoDBStruct> {
  entityName = 'poolsDemo';

  override enableCache = false;
}

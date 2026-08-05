import type { IReceiveArrivalTimeOverride } from '@onekeyhq/shared/src/utils/receiveArrivalTimeUtils';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

// Server-delivered override config for the receive page: arrival ETA seconds
// plus protocol-standard labels (e.g. "ERC20"). Fetched from
// GET /wallet/v1/network/receive-arrival-config as a standalone map — never
// embedded in the network list payload (preset networks win the getNetworks
// merge and would silently drop server-only fields).
export type IReceiveArrivalConfig = IReceiveArrivalTimeOverride & {
  standardByNetworkId?: Record<string, string>;
};

export interface IReceiveArrivalConfigDBStruct {
  config?: IReceiveArrivalConfig;
  syncedAt?: number;
}

export class SimpleDbEntityReceiveArrivalConfig extends SimpleDbEntityBase<IReceiveArrivalConfigDBStruct> {
  entityName = 'receiveArrivalConfig';

  override enableCache = false;
}

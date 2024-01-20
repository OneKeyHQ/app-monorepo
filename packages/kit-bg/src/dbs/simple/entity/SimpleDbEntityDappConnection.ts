import type { IConnectionItem } from '@onekeyhq/shared/types/dappConnection';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IDappConnectionData {
  data: IConnectionItem[];
}

export class SimpleDbEntityDappConnection extends SimpleDbEntityBase<IDappConnectionData> {
  entityName = 'DappConnection';

  override enableCache = false;
}

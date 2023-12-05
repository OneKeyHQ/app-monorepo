import type { IBrowserHistory } from '@onekeyhq/kit/src/views/Discovery/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IBrowserHistories {
  data: IBrowserHistory[];
}

export class SimpleDbEntityBrowserHistory extends SimpleDbEntityBase<IBrowserHistories> {
  entityName = 'browserHistory';

  override enableCache = false;
}

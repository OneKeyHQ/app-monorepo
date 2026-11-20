import type { IBrowserHistory } from '@onekeyhq/kit/src/views/Discovery/types';
import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBrowserHistories {
  data: IBrowserHistory[];
}

export class SimpleDbEntityBrowserHistory extends SimpleDbEntityBase<IBrowserHistories> {
  entityName = 'browserHistory';

  override enableCache = false;

  @backgroundMethod()
  async addEntry(entry: IBrowserHistory): Promise<boolean> {
    const saved = await this.setRawData((current) => ({
      data: [
        entry,
        ...(current?.data ?? []).filter(({ url }) => url !== entry.url),
      ],
    }));
    return saved !== undefined;
  }

  @backgroundMethod()
  async removeEntry(id: string): Promise<boolean> {
    const saved = await this.setRawData((current) => ({
      data: (current?.data ?? []).filter((entry) => entry.id !== id),
    }));
    return saved !== undefined;
  }
}

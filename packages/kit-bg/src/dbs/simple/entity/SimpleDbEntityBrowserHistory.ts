import { uniqBy } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { IBrowserHistory } from '@onekeyhq/shared/types/discovery';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

export interface IBrowserHistories {
  data: IBrowserHistory[];
}

export class SimpleDbEntityBrowserHistory extends SimpleDbEntityBase<IBrowserHistories> {
  entityName = 'browserHistory';

  override enableCache = false;

  @backgroundMethod()
  async addEntries(entries: IBrowserHistory[]): Promise<boolean> {
    const newestEntries = uniqBy(entries.toReversed(), ({ url }) => url);
    const newUrls = new Set(newestEntries.map(({ url }) => url));
    const saved = await this.setRawData((current) => ({
      data: [
        ...newestEntries,
        ...(current?.data ?? []).filter(({ url }) => !newUrls.has(url)),
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

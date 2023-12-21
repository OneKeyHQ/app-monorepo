import type { IBrowserBookmark } from '@onekeyhq/kit/src/views/Discovery/types';

import { SimpleDbEntityBase } from './SimpleDbEntityBase';

export interface IBrowserBookmarks {
  data: IBrowserBookmark[];
}

export class SimpleDbEntityBrowserBookmarks extends SimpleDbEntityBase<IBrowserBookmarks> {
  entityName = 'browserBookmarks';

  override enableCache = false;
}

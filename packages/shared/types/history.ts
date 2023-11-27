import type { ILocaleIds } from '@onekeyhq/components';

import type { IDecodedTx } from './tx';

export type IAccountHistory = {
  id: string;

  isLocalCreated?: boolean;

  decodedTx: IDecodedTx;
};

export type IHistoryListSectionGroup = {
  title?: string;
  titleKey?: ILocaleIds;
  data: IAccountHistory[];
};

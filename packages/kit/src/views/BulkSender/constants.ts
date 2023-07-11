import { BulkTypeEnum } from '@onekeyhq/engine/src/types/batchTransfer';

import { AmountTypeEnum } from './types';

export const amountDefaultTypeMap = {
  [BulkTypeEnum.OneToMany]: AmountTypeEnum.Fixed,
  [BulkTypeEnum.ManyToMany]: AmountTypeEnum.Random,
  [BulkTypeEnum.ManyToOne]: AmountTypeEnum.All,
};

export const amountEditorTypeMap = {
  [BulkTypeEnum.OneToMany]: [AmountTypeEnum.Fixed, AmountTypeEnum.Custom],
  [BulkTypeEnum.ManyToOne]: [
    AmountTypeEnum.Fixed,
    AmountTypeEnum.Random,
    AmountTypeEnum.All,
    AmountTypeEnum.Custom,
  ],
  [BulkTypeEnum.ManyToMany]: [
    AmountTypeEnum.Fixed,
    AmountTypeEnum.Random,
    AmountTypeEnum.All,
    AmountTypeEnum.Custom,
  ],
};

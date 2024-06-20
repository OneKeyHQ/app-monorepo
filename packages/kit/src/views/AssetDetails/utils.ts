import {
  IMPL_ADA,
  IMPL_DNX,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_XRP,
} from '@onekeyhq/shared/src/engine/engineConsts';
import type { IHistoryTxMetaComponents } from '@onekeyhq/shared/types/history';
import { EHistoryTxDetailsBlock } from '@onekeyhq/shared/types/history';

import { AdaTxFlow } from './pages/HistoryDetails/components/AdaTxMeta';
import {
  DnxAttributes,
  DnxFlow,
} from './pages/HistoryDetails/components/DnxTxMeta';
import {
  LightningTxAttributes,
  LightningTxFlow,
} from './pages/HistoryDetails/components/LigntningTxMeta';
import { XrpTxAttributes } from './pages/HistoryDetails/components/XrpTxMeta';

export function getHistoryTxMeta({ impl }: { impl: string }) {
  let components: IHistoryTxMetaComponents = {};
  switch (impl) {
    case IMPL_LIGHTNING:
    case IMPL_LIGHTNING_TESTNET:
      components = {
        [EHistoryTxDetailsBlock.Flow]: LightningTxFlow,
        [EHistoryTxDetailsBlock.Attributes]: LightningTxAttributes,
      };
      break;
    case IMPL_XRP:
      components = {
        [EHistoryTxDetailsBlock.Attributes]: XrpTxAttributes,
      };
      break;
    case IMPL_ADA:
      components = {
        [EHistoryTxDetailsBlock.Flow]: AdaTxFlow,
      };
      break;
    case IMPL_DNX:
      components = {
        [EHistoryTxDetailsBlock.Flow]: DnxFlow,
        [EHistoryTxDetailsBlock.Attributes]: DnxAttributes,
      };
      break;
    default:
      break;
  }

  return components;
}

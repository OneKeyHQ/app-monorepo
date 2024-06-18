import {
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
} from '@onekeyhq/shared/src/engine/engineConsts';
import type { IHistoryTxMetaComponents } from '@onekeyhq/shared/types/history';
import { EHistoryTxDetailsBlock } from '@onekeyhq/shared/types/history';

import {
  LightningTxAttributes,
  LightningTxFlow,
} from './pages/HistoryDetails/components/LigntningTxMeta';

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
    default:
  }

  return components;
}

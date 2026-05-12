import {
  IMPL_ADA,
  IMPL_ALGO,
  IMPL_COSMOS,
  IMPL_DNX,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_STELLAR,
  IMPL_TON,
  IMPL_TRON,
  IMPL_XRP,
} from '@onekeyhq/shared/src/engine/engineConsts';
import type { IHistoryTxMetaComponents } from '@onekeyhq/shared/types/history';
import { EHistoryTxDetailsBlock } from '@onekeyhq/shared/types/history';

import { AdaTxFlow } from './pages/HistoryDetails/components/AdaTxMeta';
import { AlgoTxAttributes } from './pages/HistoryDetails/components/AlgoTxMeta';
import { CosmosTxAttributes } from './pages/HistoryDetails/components/CosmosTxMeta';
import {
  DnxAttributes,
  DnxFlow,
} from './pages/HistoryDetails/components/DnxTxMeta';
import {
  LightningTxAttributes,
  LightningTxFlow,
} from './pages/HistoryDetails/components/LigntningTxMeta';
import { StellarTxAttributes } from './pages/HistoryDetails/components/StellarTxMeta';
import { TonTxAttributes } from './pages/HistoryDetails/components/TonTxMeta';
import { TronAttributes } from './pages/HistoryDetails/components/TronTxMeta';
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
    case IMPL_ALGO:
      components = {
        [EHistoryTxDetailsBlock.Attributes]: AlgoTxAttributes,
      };
      break;
    case IMPL_TRON:
      components = {
        [EHistoryTxDetailsBlock.Attributes]: TronAttributes,
      };
      break;
    case IMPL_COSMOS:
      components = {
        [EHistoryTxDetailsBlock.Attributes]: CosmosTxAttributes,
      };
      break;
    case IMPL_TON:
      components = {
        [EHistoryTxDetailsBlock.Attributes]: TonTxAttributes,
      };
      break;
    case IMPL_STELLAR:
      components = {
        [EHistoryTxDetailsBlock.Attributes]: StellarTxAttributes,
      };
      break;
    default:
      break;
  }

  return components;
}

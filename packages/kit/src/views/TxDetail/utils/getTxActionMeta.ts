import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';

import {
  TxActionFunctionCall,
  TxActionFunctionCallT0,
  getTxActionFunctionCallInfo,
} from '../TxAction/TxActionFunctionCall';
import {
  TxActionNFTTrade,
  TxActionNFTTradeT0,
} from '../TxAction/TxActionNFTTrade';
import {
  TxActionNFTTransfer,
  TxActionNFTTransferT0,
  getTxActionNFTInfo,
} from '../TxAction/TxActionNFTTransfer';
import {
  TxActionStake,
  TxActionStakeT0,
  getTxActionStakeInfo,
} from '../TxAction/TxActionStake';
import {
  TxActionSwap,
  TxActionSwapT0,
  getTxActionSwapInfo,
} from '../TxAction/TxActionSwap';
import {
  TxActionTokenActivate,
  TxActionTokenActivateT0,
  getTxActionTokenActivateInfo,
} from '../TxAction/TxActionTokenActivate';
import {
  TxActionTokenApprove,
  TxActionTokenApproveT0,
  getTxActionTokenApproveInfo,
} from '../TxAction/TxActionTokenApprove';
import {
  TxActionTransactionEvm,
  TxActionTransactionEvmT0,
} from '../TxAction/TxActionTransactionEvm';
import {
  TxActionTransfer,
  TxActionTransferT0,
  getTxActionTransferInfo,
} from '../TxAction/TxActionTransfer';

import type {
  ITxActionCardProps,
  ITxActionMeta,
  ITxActionMetaComponents,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

// ClipboardListMini, ClipboardListOutline, ActivityOutline
export const UNKNOWN_ACTION_ICON_NAME = 'ClipboardListOutline';

/*
T0: UI component in ListView
T1: UI component in DetailView
T2: currently unused
 */

export type IGetTxActionMetaReturn = {
  meta: ITxActionMeta;
  props: ITxActionCardProps;
  components: ITxActionMetaComponents;
};
export function getTxActionMeta(
  props: ITxActionCardProps,
): IGetTxActionMetaReturn {
  const { action } = props;
  let titleInfo: ITxActionMetaTitle | undefined = {
    titleKey: 'transaction__contract_interaction',
  };
  let iconInfo: ITxActionMetaIcon | undefined = {
    icon: {
      name: UNKNOWN_ACTION_ICON_NAME,
    },
  };
  let components: ITxActionMetaComponents = {
    // TODO network check
    T0: TxActionTransactionEvmT0, // () => null,
    T1: TxActionTransactionEvm, // () => null,
    T2: TxActionTransactionEvm, // () => null,
  };

  if (
    action.type === IDecodedTxActionType.NATIVE_TRANSFER ||
    action.type === IDecodedTxActionType.TOKEN_TRANSFER
  ) {
    const info = getTxActionTransferInfo(props);
    titleInfo = info.titleInfo;
    iconInfo = info.iconInfo;
    components = {
      T0: TxActionTransferT0,
      T1: TxActionTransfer,
      T2: TxActionTransfer,
    };
  }
  if (action.type === IDecodedTxActionType.TOKEN_APPROVE) {
    const info = getTxActionTokenApproveInfo(props);
    titleInfo = info.titleInfo;
    iconInfo = info.iconInfo;
    components = {
      T0: TxActionTokenApproveT0,
      T1: TxActionTokenApprove,
      T2: TxActionTokenApprove,
    };
  }
  if (action.type === IDecodedTxActionType.TOKEN_ACTIVATE) {
    const info = getTxActionTokenActivateInfo(props);
    titleInfo = info.titleInfo;
    iconInfo = info.iconInfo;
    components = {
      T0: TxActionTokenActivateT0,
      T1: TxActionTokenActivate,
      T2: TxActionTokenActivate,
    };
  }
  if (action.type === IDecodedTxActionType.INTERNAL_SWAP) {
    const info = getTxActionSwapInfo(props);
    titleInfo = info.titleInfo;
    iconInfo = info.iconInfo;
    components = {
      T0: TxActionSwapT0,
      T1: TxActionSwap,
      T2: TxActionSwap,
    };
  }
  if (action.type === IDecodedTxActionType.INTERNAL_STAKE) {
    const info = getTxActionStakeInfo(props);
    titleInfo = info.titleInfo;
    iconInfo = info.iconInfo;
    components = {
      T0: TxActionStakeT0,
      T1: TxActionStake,
      T2: TxActionStake,
    };
  }
  if (
    action.type === IDecodedTxActionType.NFT_TRANSFER ||
    action.type === IDecodedTxActionType.NFT_MINT ||
    action.type === IDecodedTxActionType.NFT_BURN
  ) {
    const info = getTxActionNFTInfo(props);
    titleInfo = info.titleInfo;
    iconInfo = info.iconInfo;
    components = {
      T0: TxActionNFTTransferT0,
      T1: TxActionNFTTransfer,
      T2: TxActionNFTTransfer,
    };
  }
  if (action.type === IDecodedTxActionType.NFT_SALE) {
    const info = getTxActionNFTInfo(props);
    titleInfo = info.titleInfo;
    iconInfo = info.iconInfo;
    components = {
      T0: TxActionNFTTradeT0,
      T1: TxActionNFTTrade,
      T2: TxActionNFTTrade,
    };
  }
  if (action.type === IDecodedTxActionType.FUNCTION_CALL) {
    const info = getTxActionFunctionCallInfo(props);
    titleInfo = info.titleInfo;
    components = {
      T0: TxActionFunctionCallT0,
      T1: TxActionFunctionCall,
      T2: TxActionFunctionCall,
    };
  }
  return {
    meta: { titleInfo, iconInfo },
    props,
    components,
  };
}

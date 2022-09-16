import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';

import {
  TxActionNFTTransfer,
  TxActionNFTTransferT0,
  getTxActionNFTTransferInfo,
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
import {
  ITxActionCardProps,
  ITxActionMeta,
  ITxActionMetaComponents,
  ITxActionMetaIcon,
  ITxActionMetaTitle,
} from '../types';

// ClipboardListSolid, ClipboardListOutline, ActivityOutline
export const UNKNOWN_ACTION_ICON_NAME = 'ClipboardListOutline';

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
    action.type === IDecodedTxActionType.NFT_SALE
  ) {
    const info = getTxActionNFTTransferInfo(props);
    titleInfo = info.titleInfo;
    iconInfo = info.iconInfo;
    components = {
      T0: TxActionNFTTransferT0,
      T1: TxActionNFTTransfer,
      T2: TxActionNFTTransfer,
    };
  }
  return {
    meta: { titleInfo, iconInfo },
    props,
    components,
  };
}

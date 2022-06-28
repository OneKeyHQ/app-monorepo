import { IDecodedTxActionType } from '@onekeyhq/engine/src/vaults/types';

import {
  TxActionTokenApprove,
  TxActionTokenApproveT0,
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
      name: 'ActivityOutline',
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
    titleInfo = {
      titleKey: 'title__approve',
    };
    const iconUrl = action.tokenApprove?.tokenInfo.logoURI;
    if (iconUrl) {
      iconInfo = {
        icon: {
          url: iconUrl,
        },
      };
    }
    components = {
      T0: TxActionTokenApproveT0,
      T1: TxActionTokenApprove,
      T2: TxActionTokenApprove,
    };
  }
  return {
    meta: { titleInfo, iconInfo },
    props,
    components,
  };
}

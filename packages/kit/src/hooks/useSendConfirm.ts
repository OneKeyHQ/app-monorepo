/* eslint-disable @typescript-eslint/no-shadow */
import { useCallback } from 'react';

import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';

import useAppNavigation from './useAppNavigation';

type IParams = {
  accountId: string;
  networkId: string;
};

type IBuildUnsignedTxParams = {
  encodedTx?: IEncodedTx;
  unsignedTx?: IUnsignedTxPro;
  transfersInfo?: ITransferInfo[];
  approveInfo?: IApproveInfo;
  wrappedInfo?: IWrappedInfo;
  swapInfo?: ISwapTxInfo;
  onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  onFail?: (error: Error) => void;
  sameModal?: boolean;
};

function useSendConfirm(params: IParams) {
  const { accountId, networkId } = params;

  const navigation = useAppNavigation();

  const navigationToSendConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      const { sameModal, onSuccess, onFail, ...rest } = params;
      try {
        const unsignedTx =
          await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
            networkId,
            accountId,
            ...rest,
          });
        if (sameModal) {
          navigation.push(EModalSendRoutes.SendConfirm, {
            accountId,
            networkId,
            unsignedTxs: [unsignedTx],
            onSuccess,
            onFail,
          });
        } else {
          navigation.pushModal(EModalRoutes.SendModal, {
            screen: EModalSendRoutes.SendConfirm,
            params: {
              accountId,
              networkId,
              unsignedTxs: [unsignedTx],
              onSuccess,
              onFail,
            },
          });
        }
      } catch (e: any) {
        if (onFail) {
          onFail(e);
        } else {
          throw e;
        }
      }
    },
    [accountId, navigation, networkId],
  );

  return {
    navigationToSendConfirm,
  };
}

export { useSendConfirm };

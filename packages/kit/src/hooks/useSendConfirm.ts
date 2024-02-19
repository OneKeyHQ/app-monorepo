/* eslint-disable @typescript-eslint/no-shadow */
import { useCallback } from 'react';

import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  ITransferInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { EModalRoutes } from '../routes/Modal/type';
import { EModalSendRoutes } from '../views/Send/router';

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
  onSuccess?: (txs: IEncodedTx[]) => void;
  onFail?: (error: Error) => void;
  sameModal?: boolean;
};

function useSendConfirm(params: IParams) {
  const { accountId, networkId } = params;

  const navigation = useAppNavigation();

  const navigationToSendConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      const { sameModal, ...rest } = params;
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
        });
      } else {
        navigation.pushModal(EModalRoutes.SendModal, {
          screen: EModalSendRoutes.SendConfirm,
          params: {
            accountId,
            networkId,
            unsignedTxs: [unsignedTx],
          },
        });
      }
    },
    [accountId, navigation, networkId],
  );

  return {
    navigationToSendConfirm,
  };
}

export { useSendConfirm };

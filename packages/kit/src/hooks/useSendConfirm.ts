/* eslint-disable @typescript-eslint/no-shadow */
import { useCallback } from 'react';

import { isNil } from 'lodash';

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
};

function useSendConfirm(params: IParams) {
  const { accountId, networkId } = params;

  const navigation = useAppNavigation();

  const navigationToSendConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      let unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          networkId,
          accountId,
          ...params,
        });

      const isNonceRequired = (
        await backgroundApiProxy.serviceNetwork.getNetworkSettings({
          networkId,
        })
      ).nonceRequired;

      if (isNonceRequired && isNil(unsignedTx.nonce)) {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        const nonce = await backgroundApiProxy.serviceSend.getNextNonce({
          accountId,
          networkId,
          accountAddress: account.address,
        });

        unsignedTx = await backgroundApiProxy.serviceSend.updateUnsignedTx({
          accountId,
          networkId,
          unsignedTx,
          nonceInfo: { nonce },
        });
      }

      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendConfirm,
        params: {
          accountId,
          networkId,
          unsignedTxs: [unsignedTx],
        },
      });
    },
    [accountId, navigation, networkId],
  );

  return {
    navigationToSendConfirm,
  };
}

export { useSendConfirm };

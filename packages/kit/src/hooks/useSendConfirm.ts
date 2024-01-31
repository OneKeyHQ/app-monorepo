/* eslint-disable @typescript-eslint/no-shadow */
import { useCallback } from 'react';

import { isNil } from 'lodash';

import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  ITransferInfo,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { EModalRoutes } from '../routes/Modal/type';
import { EModalSendRoutes } from '../views/Send/router';

import useAppNavigation from './useAppNavigation';

import type { ISwapTxInfo } from '../views/Swap/types';

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
  onSuccess?: (txs: ISignedTxPro[]) => void;
  onFail?: (error: Error) => void;
};

function useSendConfirm(params: IParams) {
  const { accountId, networkId } = params;

  const navigation = useAppNavigation();

  const navigationToSendConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      const {
        onSuccess,
        onFail,
        encodedTx,
        transfersInfo,
        approveInfo,
        wrappedInfo,
        unsignedTx: preUnsignedTx,
      } = params;
      let unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          networkId,
          accountId,
          unsignedTx: preUnsignedTx,
          encodedTx,
          transfersInfo,
          approveInfo,
          wrappedInfo,
        });

      const isNonceRequired =
        await backgroundApiProxy.serviceSend.getIsNonceRequired({
          networkId,
        });

      if (isNonceRequired && isNil(unsignedTx.nonce)) {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        const nonce = await backgroundApiProxy.serviceSend.getNextNonce({
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
          onSuccess,
          onFail,
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

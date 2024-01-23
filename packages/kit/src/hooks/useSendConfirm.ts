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
  encodedTx?: IEncodedTx;
  unsignedTx?: IUnsignedTxPro;
  transfersInfo?: ITransferInfo[];
  approveInfo?: IApproveInfo;
  onSuccess?: (txs: IEncodedTx[]) => void;
  onFail?: (error: Error) => void;
};

function useSendConfirm(params: IParams) {
  const {
    accountId,
    networkId,
    unsignedTx: unsignedTxFromParams,
    encodedTx,
    transfersInfo,
    approveInfo,
  } = params;

  const navigation = useAppNavigation();

  const buildUnsignedTx = useCallback(async () => {
    if (unsignedTxFromParams) return unsignedTxFromParams;

    return backgroundApiProxy.serviceSend.buildUnsignedTx({
      accountId,
      networkId,
      encodedTx,
      approveInfo,
      transfersInfo,
    });
  }, [
    accountId,
    approveInfo,
    encodedTx,
    networkId,
    transfersInfo,
    unsignedTxFromParams,
  ]);

  const navigationToSendConfirm = useCallback(async () => {
    let unsignedTx = await buildUnsignedTx();

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
      },
    });
  }, [accountId, buildUnsignedTx, navigation, networkId]);

  return {
    navigationToSendConfirm,
  };
}

export { useSendConfirm };

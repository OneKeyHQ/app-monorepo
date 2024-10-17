/* eslint-disable @typescript-eslint/no-shadow */
import { useCallback } from 'react';

import { isEmpty } from 'lodash';

import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  ITransferInfo,
  ITransferPayload,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { EModalRoutes, EModalSendRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
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
  approvesInfo?: IApproveInfo[];
  wrappedInfo?: IWrappedInfo;
  swapInfo?: ISwapTxInfo;
  stakingInfo?: IStakingInfo;
  onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  onFail?: (error: Error) => void;
  onCancel?: () => void;
  sameModal?: boolean;
  transferPayload?: ITransferPayload;
  signOnly?: boolean;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
  feeInfo?: IFeeInfoUnit;
};

function useSendConfirm(params: IParams) {
  const { accountId, networkId } = params;

  const navigation = useAppNavigation();

  const normalizeSendConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      const {
        sameModal,
        onSuccess,
        onFail,
        onCancel,
        transferPayload,
        signOnly,
        useFeeInTx,
        feeInfoEditable,
        approvesInfo,
        encodedTx,
        transfersInfo,
        ...rest
      } = params;
      try {
        const unsignedTxs = [];
        // for batch approve&swap
        if (
          approvesInfo &&
          !isEmpty(approvesInfo) &&
          (encodedTx || !isEmpty(transfersInfo))
        ) {
          let prevNonce: number | undefined;
          for (const approveInfo of approvesInfo) {
            const unsignedTx =
              await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx(
                {
                  networkId,
                  accountId,
                  approveInfo,
                  prevNonce,
                },
              );
            prevNonce = unsignedTx.nonce;
            unsignedTxs.push(unsignedTx);
          }
          unsignedTxs.push(
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              networkId,
              accountId,
              encodedTx,
              transfersInfo,
              prevNonce,
              ...rest,
            }),
          );
        } else {
          unsignedTxs.push(
            await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
              networkId,
              accountId,
              approveInfo: approvesInfo?.[0],
              encodedTx,
              transfersInfo,
              ...rest,
            }),
          );
        }

        if (sameModal) {
          navigation.push(EModalSendRoutes.SendConfirm, {
            accountId,
            networkId,
            unsignedTxs,
            onSuccess,
            onFail,
            onCancel,
            transferPayload,
            signOnly,
            useFeeInTx,
            feeInfoEditable,
          });
        } else {
          navigation.pushModal(EModalRoutes.SendModal, {
            screen: EModalSendRoutes.SendConfirm,
            params: {
              accountId,
              networkId,
              unsignedTxs,
              onSuccess,
              onFail,
              onCancel,
              transferPayload,
              signOnly,
              useFeeInTx,
              feeInfoEditable,
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

  const lightningSendConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      const { onSuccess, onFail, onCancel } = params;

      const { transfersInfo } = params;
      if (!transfersInfo?.length || transfersInfo?.length > 1) {
        throw new Error('Only one transfer is supported for lightning send');
      }
      const [transferInfo] = transfersInfo;
      const { to: toVal } = transferInfo;

      try {
        const lnurlDetails =
          await backgroundApiProxy.serviceLightning.findAndValidateLnurl({
            toVal,
            networkId,
          });

        if (lnurlDetails) {
          switch (lnurlDetails.tag) {
            case 'login':
              navigation.push(EModalSendRoutes.LnurlAuth, {
                networkId,
                accountId,
                lnurlDetails,
                isSendFlow: true,
              });
              break;
            case 'payRequest':
              navigation.push(EModalSendRoutes.LnurlPayRequest, {
                networkId,
                accountId,
                transfersInfo,
                lnurlDetails,
                onSuccess,
                onFail,
                onCancel,
                isSendFlow: true,
              });
              break;
            case 'withdrawRequest':
              navigation.push(EModalSendRoutes.LnurlWithdraw, {
                networkId,
                accountId,
                lnurlDetails,
                onSuccess,
                onFail,
                onCancel,
                isSendFlow: true,
              });
              break;
            default:
              throw new Error('Unsupported LNURL tag');
          }
          return;
        }
      } catch (e: any) {
        console.log('lightningSendConfirm error: ', e);
        if (onFail) {
          onFail(e);
        } else {
          throw e;
        }
      }

      // send invoice
      await normalizeSendConfirm(params);
    },
    [accountId, navigation, networkId, normalizeSendConfirm],
  );

  const navigationToSendConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
        await lightningSendConfirm(params);
      } else {
        await normalizeSendConfirm(params);
      }
    },
    [networkId, normalizeSendConfirm, lightningSendConfirm],
  );

  return {
    navigationToSendConfirm,
    normalizeSendConfirm,
  };
}

export { useSendConfirm };

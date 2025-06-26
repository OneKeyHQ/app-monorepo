/* eslint-disable @typescript-eslint/no-shadow */
import { useCallback } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type {
  IEncodedTx,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import type {
  IApproveInfo,
  ITransferInfo,
  ITransferPayload,
  IWrappedInfo,
} from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IDappSourceInfo } from '@onekeyhq/shared/types';
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
  isInternalSwap?: boolean;
  isInternalTransfer?: boolean;
  disableMev?: boolean;
};

function useSignatureConfirm(params: IParams) {
  const { accountId, networkId } = params;

  const navigation = useAppNavigation();
  const intl = useIntl();

  const normalizeTxConfirm = useCallback(
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
        swapInfo,
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
                  ...rest,
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
              swapInfo,
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
              swapInfo,
              encodedTx,
              transfersInfo,
              ...rest,
            }),
          );
        }

        const target = params.isInternalSwap
          ? EModalSignatureConfirmRoutes.TxConfirmFromSwap
          : EModalSignatureConfirmRoutes.TxConfirm;

        if (sameModal) {
          navigation.push(target, {
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
          navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
            screen: target,
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

  const lightningSignatureConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      const { onSuccess, onFail, onCancel } = params;

      const { transfersInfo } = params;
      if (!transfersInfo?.length || transfersInfo?.length > 1) {
        throw new OneKeyLocalError(
          'Only one transfer is supported for lightning send',
        );
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
              navigation.push(EModalSignatureConfirmRoutes.LnurlAuth, {
                networkId,
                accountId,
                lnurlDetails,
                isSendFlow: true,
              });
              break;
            case 'payRequest':
              navigation.push(EModalSignatureConfirmRoutes.LnurlPayRequest, {
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
              navigation.push(EModalSignatureConfirmRoutes.LnurlWithdraw, {
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
              throw new OneKeyLocalError('Unsupported LNURL tag');
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
      await normalizeTxConfirm(params);
    },
    [accountId, navigation, networkId, normalizeTxConfirm],
  );

  const navigationToTxConfirm = useCallback(
    async (params: IBuildUnsignedTxParams) => {
      if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
        await lightningSignatureConfirm(params);
      } else {
        await normalizeTxConfirm(params);
      }
    },
    [networkId, normalizeTxConfirm, lightningSignatureConfirm],
  );

  const navigationToMessageConfirm = useCallback(
    (params: {
      unsignedMessage: IUnsignedMessage;
      accountId: string;
      networkId: string;
      walletInternalSign?: boolean;
      sameModal?: boolean;
      swapInfo?: ISwapTxInfo;
      sourceInfo?: IDappSourceInfo;
      skipBackupCheck?: boolean;
      onSuccess?: (result: string) => void;
      onFail?: (error: Error) => void;
      onCancel?: () => void;
    }) => {
      const {
        unsignedMessage,
        accountId,
        networkId,
        sameModal,
        walletInternalSign,
        swapInfo,
        sourceInfo,
        skipBackupCheck,
        onSuccess,
        onFail,
        onCancel,
      } = params;
      const target = EModalSignatureConfirmRoutes.MessageConfirm;
      if (sameModal) {
        navigation.push(target, {
          accountId,
          networkId,
          unsignedMessage,
          walletInternalSign,
          swapInfo,
          sourceInfo,
          skipBackupCheck,
          onSuccess,
          onFail,
          onCancel,
        });
      } else {
        navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
          screen: target,
          params: {
            accountId,
            networkId,
            unsignedMessage,
            walletInternalSign,
            swapInfo,
            sourceInfo,
            skipBackupCheck,
            onSuccess,
            onFail,
            onCancel,
          },
        });
      }
    },
    [navigation],
  );

  // Promise-based version of navigationToMessageConfirm
  const navigationToMessageConfirmAsync = useCallback(
    async (params: {
      unsignedMessage: IUnsignedMessage;
      accountId: string;
      networkId: string;
      walletInternalSign?: boolean;
      sameModal?: boolean;
      swapInfo?: ISwapTxInfo;
      sourceInfo?: IDappSourceInfo;
      skipBackupCheck?: boolean;
    }): Promise<string> => {
      return new Promise((resolve, reject) => {
        navigationToMessageConfirm({
          ...params,
          onSuccess: (result) => resolve(result),
          onFail: (error) => reject(error),
          onCancel: () =>
            reject(
              new OneKeyLocalError(
                intl.formatMessage({
                  id: ETranslations.feedback_user_rejected,
                }),
              ),
            ),
        });
      });
    },
    [navigationToMessageConfirm, intl],
  );

  return {
    navigationToMessageConfirm,
    navigationToMessageConfirmAsync,
    navigationToTxConfirm,
    normalizeTxConfirm,
  };
}

export { useSignatureConfirm };

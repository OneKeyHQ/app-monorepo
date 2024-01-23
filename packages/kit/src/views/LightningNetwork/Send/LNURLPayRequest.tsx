/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { omit, pick } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Modal,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { isLightningAddress } from '@onekeyhq/engine/src/vaults/impl/lightning-network/helper/lnurl';
import type { IEncodedTxLightning } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types';
import type {
  LNURLPayServiceResponse,
  LNURLPaymentInfo,
} from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/lnurl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useNativeToken } from '../../../hooks';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { useSingleToken } from '../../../hooks/useTokens';
import { SendModalRoutes } from '../../Send/enums';
import { LNModalDescription } from '../components/LNModalDescription';
import LNSendPaymentForm from '../components/LNSendPaymentForm';

import type { SendRoutesParams } from '../../../routes';
import type { SendConfirmParams } from '../../Send/types';
import type { ISendPaymentFormValues } from '../components/LNSendPaymentForm';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.LNURLPayRequest>;

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.LNURLPayRequest
>;

const LNURLPayRequest = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { isSendFlow } = route.params ?? {};

  const {
    sourceInfo,
    lnurlDetails: dAppLnurlDetails,
    // @ts-expect-error
    transferInfo: dAppTransferInfo,
  } = useDappParams();

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const lnurlDetails = useMemo(() => {
    if (isSendFlow) {
      return pick(route.params, 'lnurlDetails').lnurlDetails;
    }
    return dAppLnurlDetails as LNURLPayServiceResponse;
  }, [route.params, dAppLnurlDetails, isSendFlow]);

  const transferInfo = useMemo(() => {
    if (isSendFlow) {
      return omit({ ...route.params }, ['lnurlDetails']);
    }
    return dAppTransferInfo;
  }, [route.params, dAppTransferInfo, isSendFlow]);

  console.log('transferInfo:=====>>>: ', transferInfo);

  const { account, accountId, networkId, network } =
    useActiveSideAccount(transferInfo);

  const amountMin = Math.floor(Number(lnurlDetails?.minSendable ?? 0) / 1000);
  const amountMax = Math.floor(Number(lnurlDetails?.maxSendable ?? 0) / 1000);

  const useFormReturn = useForm<ISendPaymentFormValues>({
    defaultValues: {
      amount: amountMin > 0 && amountMin === amountMax ? `${amountMin}` : '',
    },
  });
  const { handleSubmit } = useFormReturn;

  const [isLoading, setIsLoading] = useState(false);
  const nativeToken = useNativeToken(networkId);
  const { token: tokenInfo } = useSingleToken(
    networkId,
    transferInfo.token ?? '',
  );

  const siteImage = useMemo(() => {
    if (!lnurlDetails?.metadata) return;

    try {
      const metadata = JSON.parse(lnurlDetails.metadata);
      const image = metadata.find(
        ([type]: [string]) =>
          type === 'image/png;base64' || type === 'image/jpeg;base64',
      );

      if (image) return `data:${image[0]},${image[1]}`;
    } catch (e) {
      console.error(e);
    }
  }, [lnurlDetails?.metadata]);

  const commentAllowedLength = useMemo(() => {
    if (
      lnurlDetails &&
      typeof lnurlDetails.commentAllowed === 'number' &&
      lnurlDetails.commentAllowed > 0
    ) {
      return lnurlDetails.commentAllowed;
    }
    return 0;
  }, [lnurlDetails]);

  const onSubmit = useCallback(
    async (values: ISendPaymentFormValues) => {
      console.log('=====>onSubmit');
      if (!lnurlDetails) return;
      if (isLoading) return;
      setIsLoading(true);
      const { serviceLightningNetwork, engine } = backgroundApiProxy;

      let response: LNURLPaymentInfo;
      const amount = parseInt(values.amount) * 1000; // convert to milliSatoshi
      try {
        const params: {
          amount: number;
          comment?: string;
        } = {
          amount,
          comment: values.comment && values.comment,
        };
        response = await serviceLightningNetwork.fetchLnurlPayRequestResult({
          callback: lnurlDetails.callback,
          params,
        });
      } catch (e: any) {
        console.error(e);
        setIsLoading(false);
        const { key, info } = e;
        if (key && key !== 'onekey_error') {
          ToastManager.show(
            {
              title: intl.formatMessage(
                {
                  id: key,
                },
                info ?? {},
              ),
            },
            { type: 'error' },
          );
          return false;
        }
        ToastManager.show(
          { title: (e as Error)?.message || e },
          { type: 'error' },
        );
        dappApprove.reject();
        return;
      }

      try {
        const paymentRequest = response.pr;
        const isValidInvoice = await serviceLightningNetwork.verifyInvoice({
          paymentInfo: response,
          metadata: lnurlDetails.metadata,
          amount,
          networkId,
          accountId,
        });
        if (!isValidInvoice) {
          ToastManager.show({
            title: intl.formatMessage({
              id: 'msg__invalid_lightning_payment_request',
            }),
          });
        }

        const encodedTx = await engine.buildEncodedTxFromTransfer({
          networkId,
          accountId,
          transferInfo: {
            ...transferInfo,
            to: paymentRequest,
            lnurlPaymentInfo: response,
            lightningAddress: isLightningAddress(transferInfo.to)
              ? transferInfo.to
              : undefined,
          },
        });
        const params: SendConfirmParams = {
          accountId,
          networkId,
          encodedTx,
          feeInfoUseFeeInTx: false,
          feeInfoEditable: true,
          backRouteName: isSendFlow
            ? SendModalRoutes.PreSendAddress
            : undefined,
          // @ts-expect-error
          payload: {
            payloadType: 'Transfer',
            account,
            network,
            token: {
              ...tokenInfo,
              sendAddress: transferInfo.tokenSendAddress,
              idOnNetwork: tokenInfo?.tokenIdOnNetwork ?? '',
            },
            to: paymentRequest,
            value: (encodedTx as IEncodedTxLightning).amount,
            isMax: false,
          },
        };
        if (!isSendFlow) {
          params.sourceInfo = sourceInfo;
          params.onFail = (args) => {
            console.log('onFail', args);
            dappApprove.reject();
          };
        }
        navigation.replace(SendModalRoutes.SendConfirm, params);
      } catch (e: any) {
        console.error(e);
        setIsLoading(false);
        let message = '';
        const { key, info } = e;
        if (key && key !== 'onekey_error') {
          message = intl.formatMessage(
            {
              id: key,
            },
            info ?? {},
          );
          ToastManager.show(
            {
              title: message,
            },
            { type: 'error' },
          );
        } else {
          message = (e as Error)?.message;
          ToastManager.show({ title: message || e }, { type: 'error' });
        }
        if (!isSendFlow) {
          // display error message for 1.5s
          setTimeout(() => {
            dappApprove.resolve({
              result: {
                status: 'ERROR',
                reason: message,
              },
            });
          }, 1500);
        }
      }
    },
    [
      network,
      networkId,
      account,
      accountId,
      intl,
      isLoading,
      lnurlDetails,
      transferInfo,
      navigation,
      tokenInfo,
      dappApprove,
      sourceInfo,
      isSendFlow,
    ],
  );

  const doSubmit = handleSubmit(onSubmit);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__lnurl_pay' })}
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => doSubmit()}
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={({ close }) => {
        if (isSendFlow) {
          if (navigation?.canGoBack?.()) {
            navigation.goBack();
          }
        } else {
          dappApprove.reject();
          close();
        }
      }}
      onModalClose={() => {
        if (!isSendFlow) {
          dappApprove.reject();
        }
      }}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <LNSendPaymentForm
            accountId={accountId}
            networkId={networkId}
            useFormReturn={useFormReturn}
            amount={amountMin === amountMax ? amountMin : undefined}
            amountReadOnly={amountMin === amountMax}
            minimumAmount={amountMin}
            maximumAmount={amountMax}
            origin={new URL(lnurlDetails.url).origin}
            siteImage={siteImage}
            commentAllowedLength={commentAllowedLength}
            metadata={lnurlDetails.metadata}
            nativeToken={nativeToken}
          />
        ),
      }}
    />
  );
};

export { LNURLPayRequest };

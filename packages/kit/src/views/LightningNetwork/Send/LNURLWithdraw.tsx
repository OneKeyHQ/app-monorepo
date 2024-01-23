import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Modal,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { LNURLWithdrawServiceResponse } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/lnurl';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNativeToken, useNavigation, useNetwork } from '../../../hooks';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { SendModalRoutes } from '../../../routes/routesEnum';
import LNMakeInvoiceForm from '../components/LNMakeInvoiceForm';
import { LNModalDescription } from '../components/LNModalDescription';

import type { SendRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { SendFeedbackReceiptParams } from '../../Send/types';
import type { IMakeInvoiceFormValues } from '../components/LNMakeInvoiceForm';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<SendRoutesParams>;
type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.LNURLWithdraw>;

const LNURLWithdraw = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const {
    networkId: routeNetworkId,
    accountId: routeAccountId,
    lnurlDetails: routeLnurlDetails,
    isSendFlow,
  } = route.params ?? {};
  const {
    sourceInfo,
    networkId: dAppNetworkId,
    accountId: dAppAccountId,
    lnurlDetails: dAppLnurlDetails,
  } = useDappParams();
  const networkId = isSendFlow ? routeNetworkId : dAppNetworkId;
  const accountId = isSendFlow ? routeAccountId : dAppAccountId;
  const lnurlDetails = isSendFlow
    ? routeLnurlDetails
    : (dAppLnurlDetails as LNURLWithdrawServiceResponse);

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const { network } = useNetwork({ networkId });
  const amountMin = Math.floor(+lnurlDetails.minWithdrawable / 1000);
  const amountMax = Math.floor(+lnurlDetails.maxWithdrawable / 1000);

  const useFormReturn = useForm<IMakeInvoiceFormValues>({
    defaultValues: {
      amount: amountMin > 0 && amountMin === amountMax ? `${amountMin}` : '',
    },
  });
  const { handleSubmit } = useFormReturn;

  const nativeToken = useNativeToken(networkId);

  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = useCallback(
    async (values: IMakeInvoiceFormValues) => {
      if (isLoading) return;
      if (!networkId || !accountId) return;
      setIsLoading(true);
      const amount = values.amount || '0';
      try {
        const invoice =
          await backgroundApiProxy.serviceLightningNetwork.createInvoice({
            networkId,
            accountId,
            amount,
            description: lnurlDetails.defaultDescription,
          });
        const { callback, k1 } = lnurlDetails;
        await backgroundApiProxy.serviceLightningNetwork.fetchLnurlWithdrawRequestResult(
          {
            callback,
            k1,
            pr: invoice.payment_request,
          },
        );
        const params: SendFeedbackReceiptParams = {
          networkId,
          accountId,
          txid: 'unknown_txid',
          type: 'LNURLWithdraw',
          successAction: {
            tag: 'withdrawer',
            amount: `${amount} ${intl.formatMessage({
              id: 'form__sats__units',
            })}`,
            domain: lnurlDetails.domain,
          },
        };
        navigation.navigate(SendModalRoutes.SendFeedbackReceipt, params);
        if (!isSendFlow) {
          dappApprove.resolve();
        }
      } catch (e: any) {
        const { key, info } = e;
        let message = '';
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
          // show error message for 1.5s
          setTimeout(() => {
            dappApprove.resolve({
              result: {
                status: 'ERROR',
                reason: message,
              },
            });
          }, 1500);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      networkId,
      navigation,
      intl,
      accountId,
      lnurlDetails,
      dappApprove,
      isSendFlow,
    ],
  );

  const doSubmit = handleSubmit(onSubmit);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__lnurl_withdraw' })}
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId="action__withdraw"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={() => doSubmit()}
      secondaryActionTranslationId="action__cancel"
      onModalClose={() => {
        if (!isSendFlow) {
          dappApprove.reject();
        }
      }}
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
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <LNMakeInvoiceForm
            accountId={accountId ?? ''}
            networkId={network?.id ?? ''}
            useFormReturn={useFormReturn}
            amount={amountMin === amountMax ? amountMin : undefined}
            amountReadOnly={amountMin === amountMax}
            minimumAmount={amountMin}
            maximumAmount={amountMax}
            origin={new URL(lnurlDetails.url).origin}
            descriptionLabelId="form__withdraw_description"
            memo={lnurlDetails.defaultDescription}
            nativeToken={nativeToken}
          />
        ),
      }}
    />
  );
};

export default LNURLWithdraw;

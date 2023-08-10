import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Modal,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNativeToken, useNavigation, useNetwork } from '../../../hooks';
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

  const { networkId, accountId, lnurlDetails } = route.params ?? {};
  const { network } = useNetwork({ networkId });
  const useFormReturn = useForm<IMakeInvoiceFormValues>();
  const { handleSubmit } = useFormReturn;
  const amountMin = Math.floor(+lnurlDetails.minWithdrawable / 1000);
  const amountMax = Math.floor(+lnurlDetails.maxWithdrawable / 1000);

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
      } catch (e: any) {
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
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, networkId, navigation, intl, accountId, lnurlDetails],
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
      onSecondaryActionPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
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
            accountId={accountId}
            networkId={network?.id ?? ''}
            useFormReturn={useFormReturn}
            amount={amountMin === amountMax ? amountMin : undefined}
            amountReadOnly={amountMin === amountMax}
            minimumAmount={amountMin}
            maximumAmount={amountMax}
            domain={lnurlDetails.domain}
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

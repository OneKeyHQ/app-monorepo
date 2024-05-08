import { useCallback, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page, Toast, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';

import {
  DAppAccountListStandAloneItem,
  DAppAccountListStandAloneItemForHomeScene,
} from '../../../DAppConnection/components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import LNMakeInvoiceForm from '../../components/LNMakeInvoiceForm';

import type { IMakeInvoiceFormValues } from '../../components/LNMakeInvoiceForm';
import type { RouteProp } from '@react-navigation/core';

function LnurlWithdrawModal() {
  const intl = useIntl();
  const route =
    useRoute<RouteProp<IModalSendParamList, EModalSendRoutes.LnurlWithdraw>>();

  const { accountId, networkId, lnurlDetails, isSendFlow } = route.params;
  const origin = new URL(lnurlDetails.url).origin;

  const { $sourceInfo } = useDappQuery();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const [isLoading, setIsLoading] = useState(false);

  const {
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin });

  const amountMin = Math.floor(
    Number(lnurlDetails?.minWithdrawable ?? 0) / 1000,
  );
  const amountMax = Math.floor(
    Number(lnurlDetails?.maxWithdrawable ?? 0) / 1000,
  );
  const useFormReturn = useForm<IMakeInvoiceFormValues>({
    defaultValues: {
      amount: amountMin > 0 && amountMin === amountMax ? `${amountMin}` : '',
      description: lnurlDetails.defaultDescription,
    },
  });

  const onConfirm = useCallback(
    async (close: () => void) => {
      if (!lnurlDetails) return;
      if (isLoading) return;
      setIsLoading(true);

      const { serviceLightning } = backgroundApiProxy;
      const formValue = useFormReturn.getValues();

      const amount = new BigNumber(formValue.amount).times(1000).toNumber(); // convert to millisatoshis
      try {
        const invoice = await serviceLightning.createInvoice({
          networkId,
          accountId,
          amount: new BigNumber(amount).toString(),
          description: lnurlDetails.defaultDescription,
        });
        const { callback, k1 } = lnurlDetails;
        await serviceLightning.fetchLnurlWithdrawRequestResult({
          callback,
          k1,
          pr: invoice.payment_request,
        });
        if (!isSendFlow) {
          void dappApprove.resolve();
        }
        Toast.success({
          title: 'Withdrawer success',
        });
        close?.();
      } catch (e: any) {
        const message = (e as Error)?.message;
        if (!isSendFlow) {
          // show error message for 1.5s
          setTimeout(() => {
            void dappApprove.resolve({
              result: {
                status: 'ERROR',
                reason: message,
              },
            });
          }, 1500);
        }
        throw new OneKeyError({
          info: message,
          autoToast: true,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      useFormReturn,
      isLoading,
      lnurlDetails,
      networkId,
      accountId,
      dappApprove,
      isSendFlow,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title={intl.formatMessage({ id: 'title__lnurl_withdraw' })}
          subtitleShown={false}
          origin={origin}
          urlSecurityInfo={urlSecurityInfo}
        >
          {isSendFlow ? (
            <DAppAccountListStandAloneItemForHomeScene />
          ) : (
            <DAppAccountListStandAloneItem readonly />
          )}
          <LNMakeInvoiceForm
            accountId={accountId}
            networkId={networkId}
            useFormReturn={useFormReturn}
            amount={amountMin === amountMax ? amountMin : undefined}
            amountReadOnly={amountMin === amountMax}
            minimumAmount={amountMin}
            maximumAmount={amountMax}
            descriptionLabelId="form__withdraw_description"
            memo={lnurlDetails.defaultDescription}
            origin={origin}
          />
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          confirmText="Continue"
          continueOperate={continueOperate}
          setContinueOperate={(checked) => {
            setContinueOperate(!!checked);
          }}
          onConfirm={onConfirm}
          // onCancel={() => dappApprove.reject()}
          onCancel={() => {}}
          confirmButtonProps={{
            loading: isLoading,
            disabled: !canContinueOperate,
          }}
          showContinueOperateCheckbox={riskLevel !== 'security'}
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default LnurlWithdrawModal;

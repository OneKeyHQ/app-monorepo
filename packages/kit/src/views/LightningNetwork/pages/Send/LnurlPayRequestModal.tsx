import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page, Toast, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import { isLightningAddress } from '@onekeyhq/kit-bg/src/vaults/impls/lightning/sdkLightning/lnurl';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import type { ILNURLPaymentInfo } from '@onekeyhq/shared/types/lightning';

import { DAppAccountListStandAloneItem } from '../../../DAppConnection/components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import LNSendPaymentForm from '../../components/LNSendPaymentForm';

import type { ISendPaymentFormValues } from '../../components/LNSendPaymentForm';
import type { RouteProp } from '@react-navigation/core';

function LnurlPayRequestModal() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<IModalSendParamList, EModalSendRoutes.LnurlPayRequest>
    >();

  const { accountId, networkId, lnurlDetails, transfersInfo } = route.params;
  const origin = new URL(lnurlDetails.url).origin;

  const { $sourceInfo } = useDappQuery();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const [isLoading, setIsLoading] = useState(false);
  const sendConfirm = useSendConfirm({ accountId, networkId });

  const {
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin });

  const amountMin = Math.floor(Number(lnurlDetails?.minSendable ?? 0) / 1000);
  const amountMax = Math.floor(Number(lnurlDetails?.maxSendable ?? 0) / 1000);
  const useFormReturn = useForm<ISendPaymentFormValues>({
    defaultValues: {
      amount: amountMin > 0 && amountMin === amountMax ? `${amountMin}` : '',
      comment: '',
    },
  });

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

  const onConfirm = useCallback(
    async (close: () => void) => {
      if (!lnurlDetails) return;
      if (isLoading) return;
      setIsLoading(true);

      const { serviceLightning } = backgroundApiProxy;
      const formValue = useFormReturn.getValues();

      let response: ILNURLPaymentInfo;
      const amount = new BigNumber(formValue.amount).times(1000).toNumber(); // convert to millisatoshis
      try {
        const params: {
          amount: number;
          comment?: string;
        } = {
          amount,
          comment: formValue.comment ? formValue.comment : undefined,
        };
        response = await serviceLightning.fetchLnurlPayRequestResult({
          callback: lnurlDetails.callback,
          params,
        });
      } catch (e: any) {
        console.log('fetchLnurlPayRequestResult error: ', e);
        setIsLoading(false);
        dappApprove.reject();
        return;
      }

      try {
        const paymentRequest = response.pr;
        const isValidInvoice = await serviceLightning.verifyInvoice({
          paymentInfo: response,
          metadata: lnurlDetails.metadata,
          amount,
          networkId,
          accountId,
        });
        if (!isValidInvoice) {
          Toast.error({
            title: intl.formatMessage({
              id: 'msg__invalid_lightning_payment_request',
            }),
          });
        }
        const transferInfo = transfersInfo[0];
        const newTransfersInfo: ITransferInfo[] = [
          {
            ...transferInfo,
            to: paymentRequest,
            lnurlPaymentInfo: response,
            lightningAddress: isLightningAddress(transferInfo.to)
              ? transferInfo.to
              : undefined,
          },
        ];
        await sendConfirm.normalizeSendConfirm({
          transfersInfo: newTransfersInfo,
          sameModal: true,
        });
      } catch (e: any) {
        console.log('send invoice error: ', e);
        dappApprove.reject();
        throw new OneKeyError({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          info: e.message ?? e,
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
      transfersInfo,
      dappApprove,
      intl,
      sendConfirm,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title={intl.formatMessage({ id: 'title__lnurl_pay' })}
          subtitleShown={false}
          origin={origin}
          urlSecurityInfo={urlSecurityInfo}
        >
          {/* <DAppAccountListStandAloneItem readonly /> */}
          <LNSendPaymentForm
            accountId={accountId}
            networkId={networkId}
            useFormReturn={useFormReturn}
            amount={amountMin === amountMax ? amountMin : undefined}
            amountReadOnly={amountMin === amountMax}
            minimumAmount={amountMin}
            maximumAmount={amountMax}
            commentAllowedLength={commentAllowedLength}
            metadata={lnurlDetails.metadata}
          />
        </DAppRequestLayout>
      </Page.Body>
      <Page.Footer>
        <DAppRequestFooter
          continueOperate={continueOperate}
          setContinueOperate={(checked) => {
            setContinueOperate(!!checked);
          }}
          onConfirm={onConfirm}
          // onCancel={() => dappApprove.reject()}
          onCancel={() => {}}
          confirmButtonProps={{
            disabled: !canContinueOperate,
          }}
          showContinueOperateCheckbox={riskLevel !== 'security'}
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default LnurlPayRequestModal;

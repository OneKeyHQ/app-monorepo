import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';

import { DAppAccountListStandAloneItem } from '../../../DAppConnection/components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import LNSendPaymentForm from '../../components/LNSendPaymentForm';

import type { ISendPaymentFormValues } from '../../components/LNSendPaymentForm';

function WeblnSendPaymentModal() {
  const intl = useIntl();

  const { $sourceInfo, paymentRequest, accountId, networkId } = useDappQuery<{
    paymentRequest: string;
    accountId: string;
    networkId: string;
  }>();
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
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const { result: decodedInvoice } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceLightning.decodedInvoice({
        paymentRequest,
        networkId,
        accountId,
      }),
    [paymentRequest, networkId, accountId],
  );

  const amount = useMemo(
    () =>
      decodedInvoice?.millisatoshis
        ? new BigNumber(decodedInvoice?.millisatoshis).dividedBy(1000)
        : new BigNumber(decodedInvoice?.satoshis ?? '0'),
    [decodedInvoice],
  );

  const description = useMemo(() => {
    const memo = decodedInvoice?.tags.find(
      (tag) => tag.tagName === 'description',
    );
    return memo?.data as string;
  }, [decodedInvoice]);

  const paymentHash = useMemo(() => {
    const hash = decodedInvoice?.tags.find(
      (tag) => tag.tagName === 'payment_hash',
    );
    return hash?.data as string;
  }, [decodedInvoice]);

  const useFormReturn = useForm<ISendPaymentFormValues>({
    defaultValues: {
      amount: '',
      comment: '',
    },
  });

  useEffect(() => {
    useFormReturn.setValue('amount', amount.toFixed());
    useFormReturn.setValue('comment', description);
  }, [amount, description, useFormReturn]);

  const onConfirm = useCallback(
    async (close?: () => void) => {
      if (isLoading) return;
      setIsLoading(true);

      const formValue = useFormReturn.getValues();

      try {
        const transferInfo = {
          accountId,
          networkId,
          from: '',
          to: paymentRequest,
          amount: formValue.amount,
        };
        const transfersInfo: ITransferInfo[] = [
          {
            ...transferInfo,
          },
        ];
        await sendConfirm.normalizeSendConfirm({
          transfersInfo,
          sameModal: true,
          onSuccess: () => dappApprove.resolve({ close, result: paymentHash }),
          onFail: () => dappApprove.reject(),
        });
      } catch (e: any) {
        console.log('lnurl withdraw error: ', e);
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
      accountId,
      networkId,
      isLoading,
      dappApprove,
      useFormReturn,
      sendConfirm,
      paymentRequest,
      paymentHash,
    ],
  );

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title={intl.formatMessage({ id: 'title__lnurl_pay' })}
          subtitleShown={false}
          origin={$sourceInfo?.origin ?? ''}
          urlSecurityInfo={urlSecurityInfo}
        >
          <DAppAccountListStandAloneItem readonly />
          <LNSendPaymentForm
            isWebln
            accountId={accountId}
            networkId={networkId}
            useFormReturn={useFormReturn}
            amount={amount.toNumber()}
            amountReadOnly={amount.toNumber() !== 0}
            descriptionLabelId="title__invoice_description"
            commentAllowedLength={Number.MAX_SAFE_INTEGER}
            commentReadOnly
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
          onCancel={() => dappApprove.reject()}
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

export default WeblnSendPaymentModal;

import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useSendConfirm } from '@onekeyhq/kit/src/hooks/useSendConfirm';
import DappOpenModalPage from '@onekeyhq/kit/src/views/DAppConnection/pages/DappOpenModalPage';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

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
    showContinueOperate,
    continueOperate,
    setContinueOperate,
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
    async (close?: (extra?: { flag?: string }) => void) => {
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
          onSuccess: () => {
            void dappApprove.resolve({
              close: () => {
                close?.({ flag: EDAppModalPageStatus.Confirmed });
              },
              result: paymentHash,
            });
          },
          onFail: () => {
            void dappApprove.reject();
          },
          onCancel: () => {
            void dappApprove.reject();
          },
        });
      } catch (e: any) {
        console.log('lnurl withdraw error: ', e);
        dappApprove.reject();
        const message = (e as Error)?.message ?? e;
        throw new OneKeyError({
          message,
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
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={intl.formatMessage({
              id: ETranslations.dapp_connect_invoice_payment_request,
            })}
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
              commentAllowedLength={Number.MAX_SAFE_INTEGER}
              commentReadOnly
            />
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            confirmText={intl.formatMessage({
              id: ETranslations.global_continue,
            })}
            continueOperate={continueOperate}
            setContinueOperate={(checked) => {
              setContinueOperate(!!checked);
            }}
            onConfirm={onConfirm}
            onCancel={() => dappApprove.reject()}
            confirmButtonProps={{
              loading: isLoading,
              disabled: !continueOperate,
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default WeblnSendPaymentModal;

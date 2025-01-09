import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page, Toast, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import DappOpenModalPage from '@onekeyhq/kit/src/views/DAppConnection/pages/DappOpenModalPage';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSendRoutes,
  IModalSendParamList,
} from '@onekeyhq/shared/src/routes';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

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

  const routeParams = route.params;
  const { isSendFlow } = routeParams;
  const dAppQuery =
    useDappQuery<IModalSendParamList[EModalSendRoutes.LnurlWithdraw]>();
  const { $sourceInfo } = dAppQuery;
  const { accountId, networkId, lnurlDetails } = isSendFlow
    ? routeParams
    : dAppQuery;

  const origin = useMemo(() => {
    if (lnurlDetails?.url) {
      return new URL(lnurlDetails.url).origin;
    }
    return undefined;
  }, [lnurlDetails?.url]);

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const [isLoading, setIsLoading] = useState(false);

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: origin ?? '' });

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
    async (close?: (extra?: { flag?: string }) => void) => {
      if (!lnurlDetails) return;
      if (isLoading) return;
      const isValid = await useFormReturn.trigger();
      if (!isValid) {
        return;
      }
      setIsLoading(true);

      const { serviceLightning } = backgroundApiProxy;
      const formValue = useFormReturn.getValues();

      const amount = new BigNumber(formValue.amount).toNumber();
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
        close?.({ flag: EDAppModalPageStatus.Confirmed });
      } catch (e: any) {
        const message = (e as Error)?.message;
        if (!isSendFlow) {
          // show error message for 1.5s
          setTimeout(() => {
            void dappApprove.resolve({
              close: () => {
                close?.({ flag: EDAppModalPageStatus.Confirmed });
              },
              result: {
                status: 'ERROR',
                reason: message,
              },
            });
          }, 1500);
        }
        throw new OneKeyError({
          message,
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
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={intl.formatMessage({
              id: ETranslations.dapp_connect_lnurl_withdraw_request,
            })}
            subtitleShown={false}
            origin={origin ?? ''}
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
              memo={lnurlDetails.defaultDescription}
            />
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <DAppRequestFooter
            confirmText={intl.formatMessage({
              id: ETranslations.global_withdraw,
            })}
            continueOperate={continueOperate}
            setContinueOperate={(checked) => {
              setContinueOperate(!!checked);
            }}
            onConfirm={onConfirm}
            onCancel={() => {
              if (!isSendFlow) {
                dappApprove.reject();
              }
            }}
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

export default LnurlWithdrawModal;

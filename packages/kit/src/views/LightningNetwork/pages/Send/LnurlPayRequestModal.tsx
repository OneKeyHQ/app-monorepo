import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page, Toast, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import DappOpenModalPage from '@onekeyhq/kit/src/views/DAppConnection/pages/DappOpenModalPage';
// TODO: Move lightning utils to shared module
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import {
  findLnurl,
  isLightningAddress,
} from '@onekeyhq/kit-bg/src/vaults/impls/lightning/sdkLightning/lnurl';
import type { ITransferInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalSignatureConfirmRoutes,
  IModalSignatureConfirmParamList,
} from '@onekeyhq/shared/src/routes';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';
import {
  ELightningUnit,
  type ILNURLPaymentInfo,
} from '@onekeyhq/shared/types/lightning';

import {
  DAppAccountListStandAloneItem,
  DAppAccountListStandAloneItemForHomeScene,
} from '../../../DAppConnection/components/DAppAccountList';
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
      RouteProp<
        IModalSignatureConfirmParamList,
        EModalSignatureConfirmRoutes.LnurlPayRequest
      >
    >();
  const routeParams = route.params;
  const dAppQuery =
    useDappQuery<
      IModalSignatureConfirmParamList[EModalSignatureConfirmRoutes.LnurlPayRequest]
    >();
  const { $sourceInfo } = dAppQuery;
  const { accountId, networkId, lnurlDetails, transfersInfo } =
    routeParams.isSendFlow ? routeParams : dAppQuery;

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const [lnUnit, setLnUnit] = useState<ELightningUnit>(ELightningUnit.SATS);

  const origin = useMemo(() => {
    if (lnurlDetails?.url) {
      return new URL(lnurlDetails.url).origin;
    }
    return undefined;
  }, [lnurlDetails?.url]);

  const [isLoading, setIsLoading] = useState(false);
  const signatureConfirm = useSignatureConfirm({ accountId, networkId });

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: origin ?? '' });

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

      let response: ILNURLPaymentInfo;

      const amountSats =
        lnUnit === ELightningUnit.BTC
          ? chainValueUtils.convertBtcToSats(formValue.amount ?? 0)
          : formValue.amount ?? 0;

      const amount = new BigNumber(amountSats).times(1000).toNumber(); // convert to millisatoshis
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
        const message = (e as Error)?.message ?? e;
        throw new OneKeyError({
          message,
          autoToast: true,
        });
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
              id: ETranslations.dapp_connect_msg_invalid_lightning_payment_request,
            }),
          });
        }
        const transferInfo = transfersInfo[0];
        const lnurl = findLnurl(transferInfo.to ?? '');
        const newTransfersInfo: ITransferInfo[] = [
          {
            ...transferInfo,
            to: paymentRequest,
            lnurlPaymentInfo: response,
            lightningAddress: isLightningAddress(transferInfo.to)
              ? transferInfo.to
              : undefined,
            lnurl: lnurl ?? undefined,
          },
        ];
        await signatureConfirm.normalizeTxConfirm({
          transfersInfo: newTransfersInfo,
          sameModal: true,
          onSuccess: () => {
            if (!routeParams.isSendFlow) {
              void dappApprove.resolve({
                close: () => {
                  close?.({ flag: EDAppModalPageStatus.Confirmed });
                },
                result: {
                  status: 'OK',
                  data: undefined,
                },
              });
            }
          },
          onFail: () => {
            if (!routeParams.isSendFlow) {
              void dappApprove.reject();
            }
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
      lnurlDetails,
      isLoading,
      useFormReturn,
      lnUnit,
      dappApprove,
      networkId,
      accountId,
      transfersInfo,
      signatureConfirm,
      intl,
      routeParams.isSendFlow,
    ],
  );

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={intl.formatMessage({
              id: ETranslations.dapp_connect_lnurl_pay_request,
            })}
            subtitleShown={false}
            origin={origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
          >
            {routeParams.isSendFlow ? (
              <DAppAccountListStandAloneItemForHomeScene />
            ) : (
              <DAppAccountListStandAloneItem readonly />
            )}
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
              lnUnit={lnUnit}
              setLnUnit={setLnUnit}
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
            onCancel={() => {
              if (!routeParams.isSendFlow) {
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

export default LnurlPayRequestModal;

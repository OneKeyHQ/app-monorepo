import { useCallback, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Page, Toast, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import type { IRequestInvoiceArgs } from '@onekeyhq/shared/types/lightning/webln';

import { DAppAccountListStandAloneItem } from '../../../DAppConnection/components/DAppAccountList';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../../../DAppConnection/components/DAppRequestLayout';
import { useRiskDetection } from '../../../DAppConnection/hooks/useRiskDetection';
import LNMakeInvoiceForm from '../../components/LNMakeInvoiceForm';

import type { IMakeInvoiceFormValues } from '../../components/LNMakeInvoiceForm';

type ISourceParams = IRequestInvoiceArgs & {
  accountId: string;
  networkId: string;
};

function WeblnMakeInvoiceModal() {
  const intl = useIntl();
  const { $sourceInfo, accountId, networkId } = useDappQuery<ISourceParams>();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const [isLoading, setIsLoading] = useState(false);

  const makeInvoiceParams = $sourceInfo?.data.params as IRequestInvoiceArgs;

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    canContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const useFormReturn = useForm<IMakeInvoiceFormValues>({
    defaultValues: {
      amount: `${makeInvoiceParams.amount ?? ''}`,
      description: makeInvoiceParams.defaultMemo ?? '',
    },
  });

  const onConfirm = useCallback(
    async (close?: () => void) => {
      if (isLoading) return;
      if (!networkId || !accountId) return;
      setIsLoading(true);
      const values = useFormReturn.getValues();
      const amount = values.amount || '0';
      try {
        const invoice = await backgroundApiProxy.serviceLightning.createInvoice(
          {
            networkId,
            accountId,
            amount,
            description: values.description,
          },
        );
        Toast.success({
          title: 'Invoice created',
        });
        await dappApprove.resolve({
          close,
          result: {
            paymentRequest: invoice.payment_request,
            paymentHash: invoice.payment_hash,
          },
        });
      } catch (e: any) {
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
    [networkId, accountId, isLoading, dappApprove, useFormReturn],
  );

  return (
    <Page scrollEnabled>
      <Page.Header headerShown={false} />
      <Page.Body>
        <DAppRequestLayout
          title={intl.formatMessage({ id: 'title__create_invoice' })}
          subtitleShown={false}
          origin={$sourceInfo?.origin ?? ''}
          urlSecurityInfo={urlSecurityInfo}
        >
          <DAppAccountListStandAloneItem readonly />
          <LNMakeInvoiceForm
            isWebln
            accountId={accountId}
            networkId={networkId}
            useFormReturn={useFormReturn}
            amount={new BigNumber(makeInvoiceParams.amount ?? '').toNumber()}
            minimumAmount={new BigNumber(
              makeInvoiceParams.minimumAmount ?? '',
            ).toNumber()}
            maximumAmount={new BigNumber(
              makeInvoiceParams.maximumAmount ?? '',
            ).toNumber()}
            amountReadOnly={Number(makeInvoiceParams.amount) > 0}
            descriptionLabelId="form__withdraw_description"
            memo={makeInvoiceParams.defaultMemo}
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
          showContinueOperateCheckbox={showContinueOperate}
          riskLevel={riskLevel}
        />
      </Page.Footer>
    </Page>
  );
}

export default WeblnMakeInvoiceModal;

import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Modal,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { RequestInvoiceArgs } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/webln';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNativeToken } from '../../../hooks';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import LNMakeInvoiceForm from '../components/LNMakeInvoiceForm';
import { LNModalDescription } from '../components/LNModalDescription';

import type { IMakeInvoiceFormValues } from '../components/LNMakeInvoiceForm';

const WeblnMakeInvoice = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();

  const { accountId, networkId } = useActiveWalletAccount();
  const { sourceInfo } = useDappParams();
  const makeInvoiceParams = sourceInfo?.data.params as RequestInvoiceArgs;

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const useFormReturn = useForm<IMakeInvoiceFormValues>({
    defaultValues: {
      amount: `${makeInvoiceParams.amount ?? ''}`,
      description: makeInvoiceParams.defaultMemo ?? '',
    },
  });
  const { handleSubmit } = useFormReturn;
  const nativeToken = useNativeToken(networkId);

  const [isLoading, setIsLoading] = useState(false);
  const closeModalRef = useRef<() => void | undefined>();

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
            description: values.description,
          });
        ToastManager.show({
          title: 'Invoice created',
        });
        await dappApprove.resolve({
          close: closeModalRef.current,
          result: {
            paymentRequest: invoice.payment_request,
            paymentHash: invoice.payment_hash,
          },
        });
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
        dappApprove.reject();
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, networkId, intl, accountId, dappApprove],
  );

  const doSubmit = handleSubmit(onSubmit);

  return (
    <Modal
      header={intl.formatMessage({
        id: 'title__create_invoice',
      })}
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId="action__create"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={({ close }) => {
        closeModalRef.current = close;
        doSubmit();
      }}
      secondaryActionTranslationId="action__cancel"
      onModalClose={dappApprove.reject}
      onSecondaryActionPress={({ close }) => {
        dappApprove.reject();
        close();
      }}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <LNMakeInvoiceForm
            isWebln
            accountId={accountId}
            networkId={networkId ?? ''}
            useFormReturn={useFormReturn}
            amount={Number(makeInvoiceParams.amount)}
            minimumAmount={Number(makeInvoiceParams.minimumAmount)}
            maximumAmount={Number(makeInvoiceParams.maximumAmount)}
            origin={sourceInfo?.origin ?? ''}
            memo={makeInvoiceParams.defaultMemo}
            nativeToken={nativeToken}
            amountReadOnly={Number(makeInvoiceParams.amount) > 0}
          />
        ),
      }}
    />
  );
};

export default WeblnMakeInvoice;

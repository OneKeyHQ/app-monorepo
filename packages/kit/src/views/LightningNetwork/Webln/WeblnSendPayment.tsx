import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Modal,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IEncodedTxLightning } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types';
import type { IInvoiceDecodedResponse } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/invoice';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useNativeToken } from '../../../hooks';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { useSingleToken } from '../../../hooks/useTokens';
import { SendModalRoutes } from '../../Send/enums';
import { LNModalDescription } from '../components/LNModalDescription';
import LNSendPaymentForm from '../components/LNSendPaymentForm';

import type { SendRoutesParams } from '../../../routes';
import type { ISendPaymentFormValues } from '../components/LNSendPaymentForm';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.LNURLPayRequest
>;

const WeblnSendPayment = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();

  const { sourceInfo, networkId, accountId } = useDappParams();
  const transferInfo = useMemo(
    () => ({
      networkId: networkId ?? '',
      accountId: accountId ?? '',
    }),
    [networkId, accountId],
  );
  const { account, network } = useActiveSideAccount(transferInfo);
  const paymentRequest = sourceInfo?.data.params as string;

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
  });

  const useFormReturn = useForm<ISendPaymentFormValues>();
  const { handleSubmit } = useFormReturn;

  const nativeToken = useNativeToken(networkId);
  const { token: tokenInfo } = useSingleToken(networkId ?? '', '');

  const [isLoading, setIsLoading] = useState(false);
  const closeModalRef = useRef<() => void | undefined>();
  const [decodedInvoice, setDecodedInvoice] =
    useState<IInvoiceDecodedResponse>();

  useEffect(() => {
    if (!paymentRequest) return;
    backgroundApiProxy.serviceLightningNetwork
      .decodedInvoice({
        payReq: paymentRequest,
        networkId: networkId ?? '',
        accountId: accountId ?? '',
      })
      .then((invoice) => {
        setDecodedInvoice(invoice);
      });
  }, [paymentRequest, networkId, accountId]);

  const amount = useMemo(
    () =>
      decodedInvoice?.millisatoshis
        ? new BigNumber(decodedInvoice?.millisatoshis).dividedBy(1000)
        : new BigNumber(decodedInvoice?.satoshis ?? '0'),
    [decodedInvoice],
  );
  useEffect(() => {
    useFormReturn.setValue('amount', amount.toFixed());
  }, [amount, useFormReturn]);

  const description = useMemo(() => {
    const memo = decodedInvoice?.tags.find(
      (tag) => tag.tagName === 'description',
    );
    return memo?.data as string;
  }, [decodedInvoice]);

  const onSubmit = useCallback(
    async (values: ISendPaymentFormValues) => {
      if (isLoading) return;
      setIsLoading(true);
      const { engine } = backgroundApiProxy;
      try {
        const encodedTx = await engine.buildEncodedTxFromTransfer({
          networkId: networkId ?? '',
          accountId: accountId ?? '',
          transferInfo: {
            ...transferInfo,
            from: '',
            amount: values.amount,
            to: paymentRequest,
          },
        });
        navigation.navigate(SendModalRoutes.SendConfirm, {
          accountId: accountId ?? '',
          networkId: networkId ?? '',
          encodedTx,
          feeInfoUseFeeInTx: false,
          feeInfoEditable: true,
          backRouteName: SendModalRoutes.WeblnSendPayment,
          // @ts-expect-error
          payload: {
            payloadType: 'Transfer',
            account,
            network,
            token: {
              ...tokenInfo,
              sendAddress: '',
              idOnNetwork: tokenInfo?.tokenIdOnNetwork ?? '',
            },
            to: paymentRequest,
            value: (encodedTx as IEncodedTxLightning).amount,
            isMax: false,
          },
          sourceInfo,
          onFail: (args) => {
            console.log('payfail: ', args);
            dappApprove.reject();
          },
        });
      } catch (e: any) {
        console.error(e);
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
      } finally {
        setIsLoading(false);
      }
    },
    [
      account,
      intl,
      isLoading,
      navigation,
      network,
      paymentRequest,
      tokenInfo,
      transferInfo,
      accountId,
      networkId,
      dappApprove,
      sourceInfo,
    ],
  );

  const doSubmit = handleSubmit(onSubmit);

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__invoice_pay' })}
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId="action__next"
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
          <LNSendPaymentForm
            isWebln
            accountId={accountId ?? ''}
            networkId={networkId ?? ''}
            useFormReturn={useFormReturn}
            amount={amount.toNumber()}
            origin={sourceInfo?.origin ?? ''}
            memo={description}
            nativeToken={nativeToken}
            amountReadOnly={amount.toNumber() !== 0}
            descriptionLabelId="title__invoice_description"
          />
        ),
      }}
    />
  );
};

export default WeblnSendPayment;

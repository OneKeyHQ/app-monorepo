import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { omit, pick } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Modal,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type { IEncodedTxLightning } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types';
import type { IInvoiceDecodedResponse } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/invoice';
import type { LNURLPaymentInfo } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/lnurl';
import type { SendPaymentArgs } from '@onekeyhq/engine/src/vaults/impl/lightning-network/types/webln';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import {
  useActiveSideAccount,
  useActiveWalletAccount,
  useNativeToken,
} from '../../../hooks';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { useSingleToken } from '../../../hooks/useTokens';
import network from '../../../store/reducers/network';
import { LNModalDescription } from '../components/LNModalDescription';
import LNSendPaymentForm from '../components/LNSendPaymentForm';

import type { SendRoutesParams } from '../../../routes';
import type { SendModalRoutes } from '../../Send/enums';
import type { ISendPaymentFormValues } from '../components/LNSendPaymentForm';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.LNURLPayRequest>;

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.LNURLPayRequest
>;

const WeblnSendPayment = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  // @ts-expect-error
  const { sourceInfo, networkId, accountId } = useDappParams();
  console.log('====>route params: ', route.params);
  console.log('===>sourceInfo: ', sourceInfo, accountId, networkId);
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
        accountId,
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

  const description = useMemo(() => {
    const memo = decodedInvoice?.tags.find(
      (tag) => tag.tagName === 'description',
    );
    return memo?.data as string;
  }, [decodedInvoice]);

  return (
    <Modal
      header="Invoice Pay"
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={({ close }) => {
        closeModalRef.current = close;
        // TODO: submit
      }}
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }}
      onModalClose={() => {
        dappApprove.reject();
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
            accountId={accountId}
            networkId={networkId ?? ''}
            useFormReturn={useFormReturn}
            amount={amount.toNumber()}
            domain={sourceInfo?.hostname ?? ''}
            origin={sourceInfo?.origin}
            memo={description}
            nativeToken={nativeToken}
            amountReadOnly={amount.toNumber() !== 0}
          />
        ),
      }}
    />
  );
};

export default WeblnSendPayment;

import { useCallback, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { useRoute } from '@react-navigation/native';

import useDappApproveAction from '../../../hooks/useDappApproveAction';

import type {
  SendConfirmPayloadBase,
  SendModalRoutes,
  SendRoutesParams,
} from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.SendConfirm
>;
// type ModalNavigationProps = ModalScreenProps<SendRoutesParams>;

type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.SendConfirm>;

// TODO move to SendContext
export function useSendConfirmRouteParamsParsed() {
  const navigation = useNavigation<NavigationProps>();
  // const navigation = useNavigation<ModalNavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const defaultRouteParams = useRef({});
  const routeParams = route.params ?? defaultRouteParams.current;
  const {
    sourceInfo,
    resendActionInfo,
    encodedTx,
    onModalClose,
    networkId,
    accountId,
    prepaidFee,
  } = routeParams;
  const isFromDapp = !!routeParams.sourceInfo;
  const feeInfoEditable: boolean = routeParams.feeInfoEditable ?? true;
  const feeInfoUseFeeInTx: boolean = routeParams.feeInfoUseFeeInTx ?? false;
  const ignoreFetchFeeCalling: boolean =
    routeParams.ignoreFetchFeeCalling ?? false;
  const isSpeedUpOrCancel: boolean =
    routeParams.resendActionInfo?.type === 'cancel' ||
    routeParams.resendActionInfo?.type === 'speedUp';
  const payload = useMemo(
    // TODO refactor SendConfirmPayloadBase type like decodedTxAction
    () => routeParams.payload as SendConfirmPayloadBase | undefined,
    [routeParams.payload],
  );
  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeOnError: true,
  });
  const onModalCloseOldRef = useRef(onModalClose);
  const isClosedRef = useRef(false);
  const onClose = useCallback(() => {
    if (isClosedRef.current) {
      return;
    }
    dappApprove.reject();
    if (onModalCloseOldRef.current) {
      onModalCloseOldRef.current();
    }
    isClosedRef.current = true;
  }, [dappApprove]);

  // TODO use Context instead
  Object.assign(routeParams, { onModalClose: onClose });

  const isInternalSwapTx: boolean = payload?.payloadType === 'InternalSwap';
  // const isTransferTypeTx =
  //   decodedTx?.txType === EVMDecodedTxType.NATIVE_TRANSFER ||
  //   decodedTx?.txType === EVMDecodedTxType.TOKEN_TRANSFER;

  return {
    networkId,
    accountId,
    dappApprove,
    onModalClose: onClose,
    encodedTx,
    navigation,
    route,
    routeParams,
    sourceInfo,
    isFromDapp,
    feeInfoEditable,
    feeInfoUseFeeInTx,
    isSpeedUpOrCancel,
    payload,
    payloadInfo: routeParams.payloadInfo,
    resendActionInfo,
    isInternalSwapTx,
    isTransferTypeTx: false,
    ignoreFetchFeeCalling,
    prepaidFee,
  };
}

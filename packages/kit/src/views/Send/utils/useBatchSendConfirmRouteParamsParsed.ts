import { useCallback, useMemo, useRef } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import useDappApproveAction from '../../../hooks/useDappApproveAction';
import { SendConfirmPayloadBase, SendRoutes, SendRoutesParams } from '../types';

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.BatchSendConfirm
>;

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.BatchSendConfirm>;

export function useBatchSendConfirmRouteParamsParsed() {
  const navigation = useNavigation<NavigationProps>();
  // const navigation = useNavigation<ModalNavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const defaultRouteParams = useRef({});
  const routeParams = route.params ?? defaultRouteParams.current;
  const {
    sourceInfo,
    resendActionInfo,
    encodedTxs,
    onModalClose,
    networkId,
    accountId,
    transferCount,
  } = routeParams;
  const isFromDapp = !!routeParams.sourceInfo;
  const feeInfoEditable: boolean = routeParams.feeInfoEditable ?? true;
  const feeInfoUseFeeInTx: boolean = routeParams.feeInfoUseFeeInTx ?? false;
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

  return {
    networkId,
    accountId,
    transferCount,
    dappApprove,
    onModalClose: onClose,
    encodedTxs,
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
  };
}

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
  const route = useRoute<RouteProps>();
  const defaultRouteParams = useRef({});
  const routeParams = route.params ?? defaultRouteParams.current;
  const { sourceInfo, encodedTxs, onModalClose, networkId, accountId } =
    routeParams;
  const feeInfoEditable: boolean = routeParams.feeInfoEditable ?? true;
  const feeInfoUseFeeInTx: boolean = routeParams.feeInfoUseFeeInTx ?? false;
  const payload = useMemo(
    () => routeParams.payload as SendConfirmPayloadBase | undefined,
    [routeParams.payload],
  );
  const isFromDapp = !!routeParams.sourceInfo;
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

  Object.assign(routeParams, { onModalClose: onClose });

  return {
    networkId,
    accountId,
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
    payload,
    payloadInfo: routeParams.payloadInfo,
  };
}

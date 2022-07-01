import { useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import { SendRoutes, SendRoutesParams } from './types';

import type { SendConfirmPayloadBase } from './types';

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

export function useSendConfirmRouteParamsParsed() {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const routeParams = route.params ?? {};
  const { sourceInfo, resendActionInfo, encodedTx } = routeParams;
  const isFromDapp = !!routeParams.sourceInfo;
  const feeInfoEditable = routeParams.feeInfoEditable ?? true;
  const feeInfoUseFeeInTx = routeParams.feeInfoUseFeeInTx ?? false;
  const isSpeedUpOrCancel =
    routeParams.resendActionInfo?.type === 'cancel' ||
    routeParams.resendActionInfo?.type === 'speedUp';
  const payload = useMemo(
    // TODO refactor SendConfirmPayloadBase type like decodedTxAction
    () => (routeParams.payload || {}) as SendConfirmPayloadBase,
    [routeParams.payload],
  );

  const isInternalSwapTx = payload?.payloadType === 'InternalSwap';
  // const isTransferTypeTx =
  //   decodedTx?.txType === EVMDecodedTxType.NATIVE_TRANSFER ||
  //   decodedTx?.txType === EVMDecodedTxType.TOKEN_TRANSFER;

  return {
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
  };
}

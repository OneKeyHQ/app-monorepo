import { useCallback, useMemo } from 'react';

import { useNavigation } from '@react-navigation/core';
import { RouteProp, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

import useDappApproveAction from '../../hooks/useDappApproveAction';

import { SendRoutes, SendRoutesParams } from './types';

import type { SendConfirmPayloadBase } from './types';

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendConfirm
>;
// type ModalNavigationProps = ModalScreenProps<SendRoutesParams>;

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

export function useSendConfirmRouteParamsParsed() {
  const navigation = useNavigation<NavigationProps>();
  // const navigation = useNavigation<ModalNavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const routeParams = route.params ?? {};
  const { sourceInfo, resendActionInfo, encodedTx, onModalClose } = routeParams;
  const isFromDapp = !!routeParams.sourceInfo;
  const feeInfoEditable = routeParams.feeInfoEditable ?? true;
  const feeInfoUseFeeInTx = routeParams.feeInfoUseFeeInTx ?? false;
  const isSpeedUpOrCancel =
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
  const onClose = useCallback(() => {
    dappApprove.reject();
    if (onModalClose) {
      onModalClose();
    }
  }, [dappApprove, onModalClose]);
  // TODO use Context instead

  Object.assign(routeParams, { onModalClose: onClose });

  const isInternalSwapTx = payload?.payloadType === 'InternalSwap';
  // const isTransferTypeTx =
  //   decodedTx?.txType === EVMDecodedTxType.NATIVE_TRANSFER ||
  //   decodedTx?.txType === EVMDecodedTxType.TOKEN_TRANSFER;

  return {
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
  };
}

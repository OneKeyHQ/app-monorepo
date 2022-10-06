/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { useToast } from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { IDappSourceInfo } from '../../background/IBackgroundApi';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';
import { useOnboardingRequired } from '../../hooks/useOnboardingRequired';

import { MsgConfirmBlind } from './confirmViews/MsgConfirmBlind';
import {
  ISignMessageConfirmViewProps,
  ISignMessageConfirmViewPropsHandleConfirm,
  SignMessageConfirmModal,
} from './confirmViews/SignMessageConfirmModal';
import { TxConfirmBlind } from './confirmViews/TxConfirmBlind';
import { ITxConfirmViewPropsHandleConfirm } from './SendConfirmViews/SendConfirmModal';
import {
  SendAuthenticationParams,
  SendRoutes,
  SendRoutesParams,
} from './types';
import { useSendConfirmRouteParamsParsed } from './useSendConfirmRouteParamsParsed';

type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SignMessageConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SignMessageConfirm>;

const SignMessageConfirm = () => {
  useOnboardingRequired();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const toast = useToast();
  const route = useRoute<RouteProps>();
  // TODO useSendConfirmRouteParamsParsed
  const { sourceInfo, unsignedMessage } = route.params;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { accountId, networkId, walletId } = useActiveWalletAccount();

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeOnError: true,
  });

  const onModalClose = useCallback(() => {
    dappApprove?.reject();
  }, [dappApprove]);

  useEffect(() => {
    debugLogger.sendTx.info(
      'SignMessageConfirm  >>>>  ',
      unsignedMessage,
      route.params,
    );
  }, [unsignedMessage, route.params]);

  const handleConfirm = useCallback<ISignMessageConfirmViewPropsHandleConfirm>(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (options) => {
      const { close } = options;
      const msg = options.unsignedMessage;

      const nextRouteParams: SendAuthenticationParams = {
        ...route.params,
        unsignedMessage: msg,
        accountId,
        walletId,
        networkId,
        // TODO onComplete
        onSuccess: async (result) => {
          await dappApprove.resolve({
            result,
          });
          const successMsg = intl.formatMessage({ id: 'transaction__success' });
          toast.show({
            title: successMsg,
          });
          setTimeout(() => close(), 0);
        },
        onModalClose,
      };

      // @ts-ignore
      delete nextRouteParams._disabledAnimationOfNavigate;

      return navigation.navigate(
        SendRoutes.SendAuthentication,
        nextRouteParams,
      );
    },
    [
      route.params,
      accountId,
      walletId,
      networkId,
      onModalClose,
      navigation,
      dappApprove,
      intl,
      toast,
    ],
  );

  const sharedProps: ISignMessageConfirmViewProps = {
    handleConfirm,
    onSecondaryActionPress: ({ close }) => {
      dappApprove.reject();
      close();
    },
    onModalClose,
    sourceInfo,
    unsignedMessage,
  };

  // Dapp blind sign
  return <MsgConfirmBlind {...sharedProps} />;
};

export default SignMessageConfirm;

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
import { useOnboardingFinished } from '../../hooks/useOnboardingFinished';

import { MsgConfirmBlind } from './confirmViews/MsgConfirmBlind';
import {
  ISignMessageConfirmViewProps,
  ISignMessageConfirmViewPropsHandleConfirm,
  SignMessageConfirmModal,
} from './confirmViews/SignMessageConfirmModal';
import { TxConfirmBlind } from './confirmViews/TxConfirmBlind';
import { ITxConfirmViewPropsHandleConfirm } from './SendConfirmViews/SendConfirmModal';
import { SendRoutes, SendRoutesParams } from './types';

type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SignMessageConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SignMessageConfirm>;

const SignMessageConfirm = () => {
  useOnboardingFinished();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const toast = useToast();
  const route = useRoute<RouteProps>();
  const { sourceInfo, unsignedMessage } = route.params;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { accountId, networkId, walletId } = useActiveWalletAccount();

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeOnError: true,
  });

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

      return navigation.navigate(SendRoutes.SendAuthentication, {
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
      });
    },
    [
      navigation,
      route.params,
      accountId,
      walletId,
      networkId,
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
    onModalClose: dappApprove.reject,
    sourceInfo,
    unsignedMessage,
  };

  // Dapp blind sign
  return <MsgConfirmBlind {...sharedProps} />;
};

export default SignMessageConfirm;

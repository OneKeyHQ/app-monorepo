/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useCallback, useEffect } from 'react';

import {
  NavigationProp,
  RouteProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ModalProps } from '@onekeyhq/components/src/Modal';
import { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { IDappCallParams } from '../../background/IBackgroundApi';
import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount } from '../../hooks/redux';
import useDappApproveAction from '../../hooks/useDappApproveAction';

import { MsgConfirmBlind } from './confirmViews/MsgConfirmBlind';
import { ITxConfirmViewPropsHandleConfirm } from './confirmViews/SendConfirmModal';
import {
  ISignMessageConfirmViewProps,
  ISignMessageConfirmViewPropsHandleConfirm,
  SignMessageConfirmModal,
} from './confirmViews/SignMessageConfirmModal';
import { TxConfirmBlind } from './confirmViews/TxConfirmBlind';
import { SendRoutes, SendRoutesParams } from './types';

type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SignMessageConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SignMessageConfirm>;

const SignMessageConfirm = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();
  const { sourceInfo, unsignedMessage } = route.params;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { accountId, networkId } = useActiveWalletAccount();

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeOnError: true,
  });

  useEffect(() => {
    debugLogger.sendTx(
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
      console.log(msg);
      return navigation.navigate(SendRoutes.SendAuthentication, {
        ...route.params,
        unsignedMessage: msg,
        accountId,
        networkId,
        // TODO onComplete
        onSuccess: async (result) => {
          await dappApprove.resolve({
            result,
          });
          setTimeout(() => close(), 0);
        },
      });
    },
    [navigation, route.params, accountId, networkId, dappApprove],
  );

  const sharedProps: ISignMessageConfirmViewProps = {
    handleConfirm,
    onSecondaryActionPress: ({ close }) => {
      dappApprove.reject();
      close();
    },
    onClose: dappApprove.reject,
    sourceInfo,
    unsignedMessage,
  };

  // Dapp blind sign
  return <MsgConfirmBlind {...sharedProps} />;
};

export default SignMessageConfirm;

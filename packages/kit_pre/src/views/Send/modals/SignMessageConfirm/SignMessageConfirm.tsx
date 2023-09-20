import { useCallback, useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import { parseNetworkId } from '@onekeyhq/engine/src/managers/network';
import { ETHMessageTypes } from '@onekeyhq/engine/src/types/message';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import {
  getValidUnsignedMessage,
  validateSignMessageData,
  validateTypedSignMessageDataV1,
  validateTypedSignMessageDataV3V4,
} from '@onekeyhq/shared/src/utils/messageUtils';

import { useActiveSideAccount } from '../../../../hooks';
import useDappApproveAction from '../../../../hooks/useDappApproveAction';
import { useOnboardingRequired } from '../../../../hooks/useOnboardingRequired';
import { useSendAuthentication } from '../../../../hooks/useProtectedVerify';
import SignDetail from '../../../TxDetail/SignDetail';
import { BaseSignMessageConfirmModal } from '../../components/BaseSignMessageConfirmModal';
import { SendModalRoutes } from '../../types';

import type {
  ISignMessageConfirmViewProps,
  ISignMessageConfirmViewPropsHandleConfirm,
  SendAuthenticationParams,
  SendRoutesParams,
} from '../../types';
import type { NavigationProp, RouteProp } from '@react-navigation/native';

type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendModalRoutes.SignMessageConfirm
>;
type RouteProps = RouteProp<
  SendRoutesParams,
  SendModalRoutes.SignMessageConfirm
>;

let closeTimer: any = null;

const SignMessageConfirm = () => {
  useOnboardingRequired();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const route = useRoute<RouteProps>();
  // TODO useSendConfirmRouteParamsParsed
  const { sourceInfo, unsignedMessage, hideToast } = route.params;

  const { walletId, accountId, networkId } = useActiveSideAccount(route.params);

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeOnError: true,
  });

  const onModalClose = useCallback(() => {
    dappApprove?.reject();
    route.params.onFail?.();
  }, [dappApprove, route.params]);

  useEffect(() => {
    // clear previous close timeout if request batch sign message
    clearTimeout(closeTimer);
    debugLogger.sendTx.info(
      'SignMessageConfirm  >>>>  ',
      unsignedMessage,
      route.params,
    );
  }, [unsignedMessage, route.params]);
  const sendAuthentication = useSendAuthentication();
  const handleConfirm = useCallback<ISignMessageConfirmViewPropsHandleConfirm>(
    // eslint-disable-next-line @typescript-eslint/require-await
    async (options) => {
      const { close } = options;
      const msg = options.unsignedMessage;

      try {
        if (
          msg.type === ETHMessageTypes.ETH_SIGN ||
          msg.type === ETHMessageTypes.PERSONAL_SIGN
        ) {
          validateSignMessageData(msg);
        }
        if (msg.type === ETHMessageTypes.TYPED_DATA_V1) {
          validateTypedSignMessageDataV1(msg);
        }
        if (
          msg.type === ETHMessageTypes.TYPED_DATA_V3 ||
          msg.type === ETHMessageTypes.TYPED_DATA_V4
        ) {
          validateTypedSignMessageDataV3V4(
            msg,
            parseNetworkId(networkId).chainId,
          );
        }
      } catch (e: any) {
        dappApprove?.reject({ error: e });
        route.params.onFail?.(e);
      }

      const password = await sendAuthentication(walletId);
      if (password) {
        const nextRouteParams: SendAuthenticationParams = {
          ...route.params,
          unsignedMessage: msg,
          accountId,
          networkId,
          password,
          walletId,
          // TODO onComplete
          onSuccess: async (result) => {
            await dappApprove.resolve({
              result,
            });
            if (!hideToast) {
              const successMsg = intl.formatMessage({
                id: 'transaction__success',
              });
              ToastManager.show({
                title: successMsg,
              });
            }
            route.params.onSuccess?.(result);

            if (route.params.closeImmediately) {
              close();
            } else {
              // wait modal animation done
              closeTimer = setTimeout(() => {
                close();
              }, 600);
            }
          },
          onFail: (e) => {
            route.params.onFail?.(e);
          },
          onModalClose,
        };

        // @ts-ignore
        delete nextRouteParams._disabledAnimationOfNavigate;

        return navigation.navigate(
          SendModalRoutes.SendAuthentication,
          nextRouteParams,
        );
      }
    },
    [
      sendAuthentication,
      walletId,
      networkId,
      dappApprove,
      route.params,
      accountId,
      onModalClose,
      navigation,
      hideToast,
      intl,
    ],
  );

  const sharedProps: ISignMessageConfirmViewProps = {
    header: intl.formatMessage({ id: 'action__sign' }),
    networkId,
    accountId,
    handleConfirm,
    onSecondaryActionPress: ({ close }) => {
      dappApprove.reject();
      route.params.onFail?.();
      close();
    },
    onModalClose,
    sourceInfo,
    unsignedMessage: getValidUnsignedMessage(unsignedMessage),
  };

  // Dapp blind sign
  return (
    <BaseSignMessageConfirmModal {...sharedProps}>
      <SignDetail {...sharedProps} />
    </BaseSignMessageConfirmModal>
  );
};

export { SignMessageConfirm };

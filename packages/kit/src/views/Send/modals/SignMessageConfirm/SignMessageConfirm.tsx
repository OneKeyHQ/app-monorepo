import { useCallback, useEffect } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { ToastManager } from '@onekeyhq/components';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { useActiveSideAccount } from '../../../../hooks';
import useDappApproveAction from '../../../../hooks/useDappApproveAction';
import { useOnboardingRequired } from '../../../../hooks/useOnboardingRequired';
import SignDetail from '../../../TxDetail/SignDetail';
import { BaseSignMessageConfirmModal } from '../../components/BaseSignMessageConfirmModal';
import { SendRoutes } from '../../types';

import type {
  ISignMessageConfirmViewProps,
  ISignMessageConfirmViewPropsHandleConfirm,
  SendAuthenticationParams,
  SendRoutesParams,
} from '../../types';
import type { NavigationProp, RouteProp } from '@react-navigation/native';

type NavigationProps = NavigationProp<
  SendRoutesParams,
  SendRoutes.SignMessageConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SignMessageConfirm>;

let closeTimer: any = null;

const SignMessageConfirm = () => {
  useOnboardingRequired();
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();

  const route = useRoute<RouteProps>();
  // TODO useSendConfirmRouteParamsParsed
  const { sourceInfo, unsignedMessage } = route.params;

  const { walletId, accountId, networkId } = useActiveSideAccount(route.params);

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
    closeOnError: true,
  });

  const onModalClose = useCallback(() => {
    dappApprove?.reject();
  }, [dappApprove]);

  useEffect(() => {
    // clear previous close timeout if request batch sign message
    clearTimeout(closeTimer);
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
        networkId,
        walletId,
        // TODO onComplete
        onSuccess: async (result) => {
          await dappApprove.resolve({
            result,
          });
          const successMsg = intl.formatMessage({ id: 'transaction__success' });
          ToastManager.show({
            title: successMsg,
          });
          // wait modal animation done
          closeTimer = setTimeout(() => {
            close();
          }, 600);
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
    ],
  );

  const sharedProps: ISignMessageConfirmViewProps = {
    header: intl.formatMessage({ id: 'action__sign' }),
    networkId,
    accountId,
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
  return (
    <BaseSignMessageConfirmModal {...sharedProps}>
      <SignDetail {...sharedProps} />
    </BaseSignMessageConfirmModal>
  );
};

export { SignMessageConfirm };

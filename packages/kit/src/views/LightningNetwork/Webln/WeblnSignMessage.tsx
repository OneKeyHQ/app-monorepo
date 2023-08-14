import { useCallback, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Modal,
  ToastManager,
  useForm,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { LNModalDescription } from '../components/LNModalDescription';
import LNSignMessageForm from '../components/LNSignMessageForm';

import { WeblnModalRoutes } from './types';

import type { ISignMessageFormValues } from '../components/LNSignMessageForm';
import type { WeblnRoutesParams } from './types';
import type { RouteProp } from '@react-navigation/core';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<WeblnRoutesParams, WeblnModalRoutes.SignMessage>;

type NavigationProps = NativeStackNavigationProp<
  WeblnRoutesParams,
  WeblnModalRoutes.SignMessage
>;

const WeblnSignMessage = () => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  // @ts-expect-error
  const { sourceInfo, networkId, accountId, walletId } = useDappParams();
  console.log('====>route params: ', route.params);
  console.log('===>sourceInfo: ', sourceInfo, accountId, networkId);
  const message = sourceInfo?.data.params as string;

  const dappApprove = useDappApproveAction({
    id: sourceInfo?.id ?? '',
  });

  const useFormReturn = useForm<ISignMessageFormValues>();

  const [isLoading, setIsLoading] = useState(false);
  const closeModalRef = useRef<() => void | undefined>();

  const onDone = useCallback(
    async (password: string) => {
      if (isLoading) return;
      setIsLoading(true);
      try {
        const result =
          await backgroundApiProxy.serviceLightningNetwork.weblnSignMessage({
            password,
            message,
            accountId,
            networkId: networkId ?? '',
          });
        await dappApprove.resolve({
          close: closeModalRef.current,
          result,
        });
      } catch (e: any) {
        const { key, info } = e;
        if (key && key !== 'onekey_error') {
          ToastManager.show(
            {
              title: intl.formatMessage(
                {
                  id: key,
                },
                info ?? {},
              ),
            },
            { type: 'error' },
          );
          dappApprove.reject();
          return false;
        }
        ToastManager.show(
          { title: (e as Error)?.message || e },
          { type: 'error' },
        );
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [intl, isLoading, accountId, networkId, dappApprove, message],
  );

  const onConfirmWithAuth = useCallback(
    () =>
      navigation.navigate(WeblnModalRoutes.WeblnAuthentication, {
        walletId,
        onDone,
      }),
    [walletId, navigation, onDone],
  );

  return (
    <Modal
      header="Invoice Pay"
      headerDescription={<LNModalDescription networkId={networkId} />}
      primaryActionTranslationId="action__next"
      primaryActionProps={{
        isDisabled: isLoading,
        isLoading,
      }}
      onPrimaryActionPress={({ close }) => {
        closeModalRef.current = close;
        onConfirmWithAuth();
      }}
      secondaryActionTranslationId="action__cancel"
      onSecondaryActionPress={() => {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }
      }}
      onModalClose={() => {
        dappApprove.reject();
      }}
      height="auto"
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          paddingVertical: isVerticalLayout ? 16 : 24,
        },
        children: (
          <LNSignMessageForm
            accountId={accountId}
            networkId={networkId ?? ''}
            useFormReturn={useFormReturn}
            origin={sourceInfo?.origin ?? ''}
            message={message}
          />
        ),
      }}
    />
  );
};

export default WeblnSignMessage;

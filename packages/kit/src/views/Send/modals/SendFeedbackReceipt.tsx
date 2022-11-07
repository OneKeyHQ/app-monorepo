/* eslint-disable global-require */
import React, { useCallback, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { isFunction } from 'lodash';
import { useIntl } from 'react-intl';

import { Box, LottieView, Text, VStack } from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount, useInterval } from '../../../hooks';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { BaseSendModal } from '../components/BaseSendModal';
import { SendRoutes, SendRoutesParams } from '../types';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendFeedbackReceipt>;

export function SendFeedbackReceipt() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const closeModal = useModalClose();
  const { networkId, accountId } = route.params;
  const { network } = useActiveSideAccount(route.params);
  const openBlockBrowser = useOpenBlockBrowser(network);
  const [count, setCount] = useState(3);
  const isExtStandaloneWindow = platformEnv.isExtensionUiStandaloneWindow;
  const isAutoClose = isExtStandaloneWindow;
  const { serviceDapp } = backgroundApiProxy;
  useEffect(() => {
    const registerWindowUnload = isExtStandaloneWindow;
    if (registerWindowUnload) {
      window.addEventListener('beforeunload', () =>
        serviceDapp.setSendConfirmModalVisible({ visible: false }),
      );
    }
    return () => {
      serviceDapp.setSendConfirmModalVisible({ visible: false });
      if (registerWindowUnload) {
        window.removeEventListener('beforeunload', () =>
          serviceDapp.setSendConfirmModalVisible({ visible: false }),
        );
      }
    };
  }, [serviceDapp]);

  const doClose = useCallback(() => {
    if (isFunction(route?.params?.closeModal)) {
      route?.params?.closeModal?.();
    } else {
      closeModal();
    }
    serviceDapp.setSendConfirmModalVisible({ visible: false });
  }, [serviceDapp, closeModal, route?.params]);
  useInterval(() => {
    if (!isAutoClose) {
      return;
    }
    setCount((num) => {
      const newNum = num - 1;
      if (newNum <= 0) {
        doClose();
      }
      return newNum;
    });
  }, 1000);
  return (
    <BaseSendModal
      networkId={networkId}
      accountId={accountId}
      hideBackButton
      height="auto"
      header={undefined}
      headerDescription={undefined}
      primaryActionProps={{
        children: isAutoClose
          ? `${intl.formatMessage({ id: 'action__done' })} (${count})`
          : `${intl.formatMessage({ id: 'action__done' })}`,
      }}
      onPrimaryActionPress={() => doClose()}
      hideSecondaryAction={
        !(
          openBlockBrowser.hasAvailable ||
          typeof route.params.onDetail === 'function'
        )
      }
      secondaryActionTranslationId="action__view_details"
      onSecondaryActionPress={() => {
        doClose();
        setTimeout(() => {
          if (route.params.onDetail) {
            route.params.onDetail?.(route?.params?.txid);
          } else {
            openBlockBrowser.openTransactionDetails(route?.params?.txid);
          }
        }, 100);
      }}
      closeAction={() => doClose()}
    >
      <VStack
        alignItems="center"
        justifyContent="center"
        flex={1}
        // bgColor="surface-neutral-default"
      >
        <Box w="200px" h="200px">
          <LottieView
            width={200}
            source={require('@onekeyhq/kit/assets/animations/lottie_send_success_feedback.json')}
            autoPlay
            loop={false}
          />
        </Box>
        <Text typography="DisplayMedium">
          {intl.formatMessage({ id: 'modal__transaction_submitted' })}
        </Text>
        <Box h={8} />
      </VStack>
    </BaseSendModal>
  );
}

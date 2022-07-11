import React, { useCallback, useMemo, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { isFunction } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  HStack,
  Icon,
  LottieView,
  Pressable,
  Text,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useActiveWalletAccount, useInterval } from '../../../hooks';
import useOpenBlockBrowser from '../../../hooks/useOpenBlockBrowser';
import { BaseSendModal } from '../components/BaseSendModal';
import { SendRoutes, SendRoutesParams } from '../types';

type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendFeedbackReceipt>;

export function SendFeedbackReceipt() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { network } = useActiveWalletAccount();
  const closeModal = useModalClose();
  const openBlockBrowser = useOpenBlockBrowser(network);
  const [count, setCount] = useState(3);
  const isAutoClose = platformEnv.isExtensionUiStandaloneWindow;
  const doClose = useCallback(() => {
    if (isFunction(route?.params?.closeModal)) {
      route?.params?.closeModal?.();
    } else {
      closeModal();
    }
  }, [closeModal, route?.params]);
  useInterval(() => {
    if (!isAutoClose) {
      return;
    }
    setCount((num) => {
      const newNum = num - 1;
      console.log('SendFeedbackReceipt close interval', newNum);
      if (newNum <= 0) {
        doClose();
      }
      return newNum;
    });
  }, 1000);
  const feedbackAnimation = useMemo(
    () => (
      <LottieView
        style={{ width: '200px' }}
        // eslint-disable-next-line global-require
        source={require('@onekeyhq/kit/assets/animations/lottie_send_success_feedback.json')}
        autoPlay={false}
        loop={false}
      />
    ),
    [],
  );
  return (
    <BaseSendModal
      hideBackButton
      height="auto"
      hideSecondaryAction
      header={undefined}
      headerDescription={undefined}
      primaryActionProps={{
        children: isAutoClose
          ? `${intl.formatMessage({ id: 'action__close' })} (${count})`
          : `${intl.formatMessage({ id: 'action__close' })}`,
      }}
      onPrimaryActionPress={() => doClose()}
      closeAction={() => doClose()}
    >
      <VStack alignItems="center" justifyContent="center" minH="100%">
        {/* <Icon name="CheckCircleSolid" color="interactive-default" size={150} /> */}
        {feedbackAnimation}
        <Text typography="DisplayMedium">
          {intl.formatMessage({ id: 'modal__transaction_submitted' })}
        </Text>
        {openBlockBrowser.hasAvailable ? (
          <>
            <Box h={4} />
            <Pressable
              onPress={() => {
                openBlockBrowser.openTransactionDetails(route.params.txid);
                doClose();
              }}
            >
              <HStack space={2} alignItems="center">
                <Text typography="Button1" color="interactive-default">
                  {intl.formatMessage({ id: 'action__view_in_explorer' })}
                </Text>
                <Icon
                  name="ExternalLinkSolid"
                  size={20}
                  color="interactive-default"
                />
              </HStack>
            </Pressable>
          </>
        ) : null}
        <Box h={8} />
      </VStack>
    </BaseSendModal>
  );
}

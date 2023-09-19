/* eslint-disable global-require */
import { useCallback, useEffect } from 'react';

import { useRoute } from '@react-navigation/native';
import { isFunction } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  LottieView,
  Spinner,
  Text,
  Typography,
  VStack,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import {
  AppUIEventBusNames,
  appUIEventBus,
} from '@onekeyhq/shared/src/eventBus/appUIEventBus';

import { BaseSendModal } from '../components/BaseSendModal';

import type { SendModalRoutes, SendRoutesParams } from '../types';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  SendRoutesParams,
  SendModalRoutes.HardwareSwapContinue
>;

export function HardwareSwapContinue() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const closeModal = useModalClose();
  const { networkId, accountId } = route.params;
  const doClose = useCallback(() => {
    if (isFunction(route?.params?.closeModal)) {
      route?.params?.closeModal?.();
    } else {
      closeModal();
    }
  }, [closeModal, route?.params]);

  useEffect(() => {
    appUIEventBus.on(AppUIEventBusNames.SwapError, doClose);
    appUIEventBus.on(AppUIEventBusNames.SwapCompleted, doClose);
    return () => {
      appUIEventBus.off(AppUIEventBusNames.SwapError, doClose);
      appUIEventBus.off(AppUIEventBusNames.SwapCompleted, doClose);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <BaseSendModal
      networkId={networkId}
      accountId={accountId}
      hideBackButton
      height="auto"
      header={undefined}
      headerDescription={undefined}
      primaryActionProps={{
        children: `${intl.formatMessage({ id: 'action__close' })}`,
        type: 'basic',
      }}
      onPrimaryActionPress={() => doClose()}
      hideSecondaryAction
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
          {intl.formatMessage({ id: 'title__swap_processing_1_2' })}
        </Text>
        <Box h={8} />
        <Box position="relative">
          <Box display="flex" flexDirection="row" alignItems="center">
            <Center
              w="8"
              h="8"
              backgroundColor="interactive-default"
              borderRadius="full"
              mr="6"
            >
              <Icon name="CheckMini" size={20} color="text-on-primary" />
            </Center>
            <Box>
              <Typography.Body1Strong>
                {intl.formatMessage({ id: 'title__approved' })}
              </Typography.Body1Strong>
              <Typography.Body1Strong>
                {intl.formatMessage({
                  id: 'transaction__swap_status_completed',
                })}
              </Typography.Body1Strong>
            </Box>
          </Box>
          <Box h="6" />
          <Box display="flex" flexDirection="row" alignItems="center">
            <Center
              w="8"
              h="8"
              backgroundColor="surface-subdued"
              borderRadius="full"
              borderWidth="2"
              borderColor="interactive-default"
              mr="6"
            >
              <Box
                w="2"
                h="2"
                borderRadius="full"
                backgroundColor="interactive-default"
              />
            </Center>
            <Box>
              <Typography.Body1Strong>
                {intl.formatMessage({ id: 'form__swap_tokens' })}
              </Typography.Body1Strong>
              <Box flexDirection="row">
                <Spinner size="sm" />
                <Typography.Body1Strong ml="2">
                  {intl.formatMessage({
                    id: 'form__please_confirm_on_device',
                  })}
                </Typography.Body1Strong>
              </Box>
            </Box>
          </Box>
          <Box
            w="8"
            h="full"
            position="absolute"
            top="0"
            left="0"
            display="flex"
            justifyContent="center"
            alignItems="center"
            zIndex={-1}
          >
            <Box w="1" height="80%" bg="interactive-default" />
          </Box>
        </Box>
      </VStack>
    </BaseSendModal>
  );
}

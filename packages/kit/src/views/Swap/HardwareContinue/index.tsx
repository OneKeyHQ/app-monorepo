/* eslint-disable global-require */
import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  LottieView,
  Modal,
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

const HardwareContine = () => {
  const intl = useIntl();
  const closeModal = useModalClose();

  useEffect(() => {
    appUIEventBus.on(AppUIEventBusNames.LimitOrderError, closeModal);
    appUIEventBus.on(AppUIEventBusNames.LimitOrderCompleted, closeModal);
    return () => {
      appUIEventBus.off(AppUIEventBusNames.LimitOrderError, closeModal);
      appUIEventBus.off(AppUIEventBusNames.LimitOrderCompleted, closeModal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Modal>
      <VStack alignItems="center" justifyContent="center" flex={1}>
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
                {intl.formatMessage({ id: 'action__sign' })}
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
    </Modal>
  );
};

export default HardwareContine;

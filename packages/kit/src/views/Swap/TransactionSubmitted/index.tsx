import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, LottieView, Modal, Text, VStack } from '@onekeyhq/components';

import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { SwapRoutes } from '../typings';

import type { SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.TransactionSubmitted>;

const TransactionSubmittedModal = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation();
  const onDetails = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Swap,
      params: {
        screen: SwapRoutes.LimitOrderDetails,
        params: {
          orderHash: route.params.orderHash,
        },
      },
    });
  }, [navigation, route.params.orderHash]);
  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__transaction_submitted' })}
      primaryActionTranslationId="action__close"
      secondaryActionTranslationId="action__view_details"
      onPrimaryActionPress={({ close }) => close?.()}
      onSecondaryActionPress={onDetails}
    >
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
          {intl.formatMessage({ id: 'action__submit' })}
        </Text>
        <Box h={8} />
      </VStack>
    </Modal>
  );
};

export default TransactionSubmittedModal;

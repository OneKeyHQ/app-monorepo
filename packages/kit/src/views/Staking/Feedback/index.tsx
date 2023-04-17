import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, LottieView, Modal, Text, VStack } from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.Feedback>;

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

const TransactionFeedback = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const doClose = useCallback(() => {
    navigation.replace(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.StakedETHOnKele,
        params: {
          networkId: route.params.networkId,
        },
      },
    });
  }, [navigation, route.params.networkId]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'modal__transaction_submitted' })}
      hideSecondaryAction
      primaryActionTranslationId="action__close"
      onPrimaryActionPress={doClose}
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

export default TransactionFeedback;

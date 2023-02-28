import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Button, Center, Modal, Typography } from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { setSlippage as setSlippageAction } from '../../../store/reducers/swapTransactions';

import type { SwapRoutes, SwapRoutesParams } from '../typings';
import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<SwapRoutesParams, SwapRoutes.SlippageCheck>;

const SlippageCheck = () => {
  const intl = useIntl();

  const route = useRoute<RouteProps>();
  const navigation = useNavigation();

  const onChange = useCallback(() => {
    backgroundApiProxy.dispatch(setSlippageAction(route.params));
    const instance = navigation.getParent() || navigation;
    instance.goBack();
  }, [navigation, route.params]);

  const onResetNext = useCallback(() => {
    backgroundApiProxy.dispatch(
      setSlippageAction({ ...route.params, autoReset: true }),
    );
    const instance = navigation.getParent() || navigation;
    instance.goBack();
  }, [route.params, navigation]);

  return (
    <Modal footer={null}>
      <Box>
        <Center py="8">
          <Typography.Heading fontSize="56px" lineHeight="70px">
            🔄
          </Typography.Heading>
        </Center>
        <Center py="3">
          <Typography.DisplayMedium>
            {intl.formatMessage({ id: 'modal__slippage_changed' })}
          </Typography.DisplayMedium>
        </Center>
        <Typography.Body1 color="text-subdued">
          {intl.formatMessage({ id: 'modal__slippage_changed_desc' })}
        </Typography.Body1>
        <Box mt="5">
          <Button size="xl" onPress={onChange}>
            {intl.formatMessage(
              { id: 'action__keep_this_settings_str' },
              { '0': `${route.params.value ?? ''}%` },
            )}
          </Button>
          <Button mt="3" size="xl" type="primary" onPress={onResetNext}>
            {intl.formatMessage({
              id: 'action__reset_for_me_in_the_next_swap',
            })}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
};

export default SlippageCheck;

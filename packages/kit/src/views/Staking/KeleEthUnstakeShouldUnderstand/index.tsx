import { useCallback } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Box, Center, Image, Modal, Typography } from '@onekeyhq/components';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import ETHLogoPNG from '../../../../assets/staking/eth_unstake.png';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { StakingRoutes } from '../typing';

import type { StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  StakingRoutesParams,
  StakingRoutes.KeleEthUnstakeShouldUnderstand
>;

type NavigationProps = ModalScreenProps<StakingRoutesParams>;

export default function KeleEthUnstakeShouldUnderstand() {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const { params } = useRoute<RouteProps>();

  const onSubmit = useCallback(() => {
    if (params.readonly) {
      navigation.goBack();
    } else {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Staking,
        params: {
          screen: StakingRoutes.UnstakeAmount,
          params: {
            networkId: params.networkId,
          },
        },
      });
    }
  }, [navigation, params.networkId, params.readonly]);
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__unstake_eth' })}
      hideSecondaryAction
      primaryActionTranslationId="action__i_got_it"
      onPrimaryActionPress={onSubmit}
      scrollViewProps={{
        children: (
          <Box>
            <Center p="6">
              <Image w="24" h="24" source={ETHLogoPNG} />
              <Typography.DisplayLarge mt="6" mb="2">
                {intl.formatMessage({ id: 'title__unstake_eth' })}
              </Typography.DisplayLarge>
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage({
                  id: 'form__the_unstaking_process_will_be_completed_in_two_stages',
                })}
              </Typography.Body2>
            </Center>
            <Box>
              <Box flexDirection="row">
                <Center
                  w="8"
                  h="8"
                  borderRadius="full"
                  bg="decorative-surface-one"
                  mr="4"
                >
                  <Typography.Body2Strong color="decorative-icon-one">
                    1
                  </Typography.Body2Strong>
                </Center>
                <Box flex="1">
                  <Typography.Body1Strong>
                    {intl.formatMessage({ id: 'action__unstake' })}
                  </Typography.Body1Strong>
                  <Typography.Body2 color="text-subdued">
                    {intl.formatMessage({ id: 'form__unstake_desc' })}
                  </Typography.Body2>
                </Box>
              </Box>
              <Box flexDirection="row" mt="5">
                <Center
                  w="8"
                  h="8"
                  borderRadius="full"
                  bg="decorative-surface-one"
                  mr="4"
                >
                  <Typography.Body2Strong color="decorative-icon-one">
                    2
                  </Typography.Body2Strong>
                </Center>
                <Box flex="1">
                  <Typography.Body1Strong>
                    {intl.formatMessage({ id: 'action__withdraw' })}
                  </Typography.Body1Strong>
                  <Typography.Body2
                    color="text-subdued"
                    textBreakStrategy="highQuality"
                  >
                    {intl.formatMessage({ id: 'form__withdraw_desc' })}
                  </Typography.Body2>
                </Box>
              </Box>
            </Box>
          </Box>
        ),
      }}
    />
  );
}

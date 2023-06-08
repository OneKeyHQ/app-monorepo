import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Box, Center, Image, Modal, Typography } from '@onekeyhq/components';

import { useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { StakingRoutes } from '../typing';

const LidoEthUnstakeShouldUnderstandContent = () => {
  const intl = useIntl();
  return (
    <Box>
      <Center mt="8" mb="10">
        <Image
          w="24"
          h="24"
          mb="2"
          source={require('@onekeyhq/kit/assets/staking/lido_pool.png')}
        />
        <Typography.DisplayLarge>
          {intl.formatMessage({ id: 'title__lido_unstaking' })}
        </Typography.DisplayLarge>
        <Typography.Body1 color="text-subdued" mt="2">
          {intl.formatMessage({ id: 'title__lido_unstaking_desc' })}
        </Typography.Body1>
      </Center>
      <Box>
        <Box flexDirection="row" mb="8">
          <Center
            w="8"
            h="8"
            mr="2"
            borderRadius="full"
            bg="decorative-surface-one"
          >
            <Typography.Body2Strong color="decorative-icon-one">
              1
            </Typography.Body2Strong>
          </Center>
          <Box flex="1">
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'form__request_withdrawal' })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__request_withdrawal_desc' })}
            </Typography.Body2>
          </Box>
        </Box>
        <Box flexDirection="row" mb="8">
          <Center
            w="8"
            h="8"
            mr="2"
            borderRadius="full"
            bg="decorative-surface-one"
          >
            <Typography.Body2Strong color="decorative-icon-one">
              2
            </Typography.Body2Strong>
          </Center>
          <Box flex="1">
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'form__receive_lido_nft' })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({
                id: 'form__receive_lido_nft_desc',
              })}
            </Typography.Body2>
          </Box>
        </Box>
        <Box flexDirection="row" mb="8">
          <Center
            w="8"
            h="8"
            mr="2"
            borderRadius="full"
            bg="decorative-surface-one"
          >
            <Typography.Body2Strong color="decorative-icon-one">
              3
            </Typography.Body2Strong>
          </Center>
          <Box flex="1">
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'form__claim' })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__claim_desc' })}
            </Typography.Body2>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

const LidoEthUnstakeShouldUnderstand = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const onPrimaryActionPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.LidoEthUnstake,
        params: {},
      },
    });
  }, [navigation]);
  return (
    <Modal
      hideSecondaryAction
      primaryActionTranslationId="action__i_got_it"
      onPrimaryActionPress={onPrimaryActionPress}
      header={`${intl.formatMessage({ id: 'action_unstake' })} ETH`}
      scrollViewProps={{
        children: <LidoEthUnstakeShouldUnderstandContent />,
      }}
    />
  );
};

export default LidoEthUnstakeShouldUnderstand;

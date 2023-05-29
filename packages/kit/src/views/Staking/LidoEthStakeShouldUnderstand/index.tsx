import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Collapse,
  Icon,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import { Body1Strong } from '@onekeyhq/components/src/Typography';

import { useNavigation } from '../../../hooks';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { EthStakingSource, StakingRoutes } from '../typing';

const TypographyStrong = (text: string) => (
  <Typography.Body1 color="text-success">{text}</Typography.Body1>
);

const LidoEthStakingContent = () => {
  const intl = useIntl();
  return (
    <Box>
      <VStack space={4}>
        <Box
          py="3"
          px="4"
          flexDirection="row"
          borderRadius={12}
          bg="surface-default"
        >
          <Box mr="3">
            <Icon name="ChartBarOutline" />
          </Box>
          <Body1Strong>
            {intl.formatMessage(
              { id: 'form__earn_up_to_str_per_year' },
              { 'a': TypographyStrong, '0': '4.58%' },
            )}
          </Body1Strong>
        </Box>
        <Box
          py="3"
          px="4"
          flexDirection="row"
          borderRadius={12}
          bg="surface-default"
        >
          <Box mr="3">
            <Icon name="ArrowsRightLeftOutline" />
          </Box>
          <Box flex="1">
            <Body1Strong>
              {intl.formatMessage(
                {
                  id: 'form__when_you_stake_str_you_receive_str_you_can_trade_this_liquid_asset_at_any_time',
                },
                {
                  'a': TypographyStrong,
                  'b': TypographyStrong,
                  '0': 'ETH',
                  '1': 'stETH',
                },
              )}
            </Body1Strong>
          </Box>
        </Box>
        <Box
          py="3"
          px="4"
          flexDirection="row"
          borderRadius={12}
          bg="surface-default"
        >
          <Box mr="3">
            <Icon name="ClockOutline" />
          </Box>
          <Box flex="1">
            <Body1Strong>
              {intl.formatMessage(
                { id: 'form__you_start_earning_str' },
                { 'a': TypographyStrong },
              )}
            </Body1Strong>
          </Box>
        </Box>
        <Box
          py="3"
          px="4"
          flexDirection="row"
          borderRadius={12}
          bg="surface-default"
        >
          <Box mr="3">
            <Icon name="GiftOutline" />
          </Box>
          <Body1Strong>
            {intl.formatMessage(
              {
                id: 'form__rewards_are_automatically_credited_to_your_deposit_every_few_days',
              },
              { 'a': TypographyStrong },
            )}
          </Body1Strong>
        </Box>
      </VStack>
      <Collapse
        renderCustomTrigger={(onPress, collapsed) => (
          <Box py="4">
            <Button size="sm" type="plain" onPress={onPress}>
              {collapsed
                ? intl.formatMessage({ id: 'action__learn_more' })
                : intl.formatMessage({ id: 'action__collapse' })}
            </Button>
          </Box>
        )}
      >
        <VStack>
          <Collapse
            trigger={
              <Typography.Body1 color="text-default">
                {intl.formatMessage({
                  id: 'form__how_does_the_lido_protocol_work',
                })}
              </Typography.Body1>
            }
          >
            <Typography.Body1 px="2" color="text-subdued">
              {intl.formatMessage({
                id: 'form__how_does_the_lido_protocol_work_desc',
              })}
            </Typography.Body1>
          </Collapse>
          <Collapse
            trigger={
              <Typography.Body1 color="text-default">
                {intl.formatMessage({ id: 'form__why_do_you_receive_steth' })}
              </Typography.Body1>
            }
          >
            <Typography.Body1 px="2" color="text-subdued">
              {intl.formatMessage({
                id: 'form__why_do_you_receive_steth_desc',
              })}
            </Typography.Body1>
          </Collapse>
          <Collapse
            trigger={
              <Typography.Body1 color="text-default">
                {intl.formatMessage({
                  id: 'form__what_is_the_possible_risk_of_lido',
                })}
              </Typography.Body1>
            }
          >
            <Typography.Body1 px="2" color="text-subdued">
              {intl.formatMessage({
                id: 'form__what_is_the_possible_risk_of_lido_desc',
              })}
            </Typography.Body1>
          </Collapse>
        </VStack>
      </Collapse>
    </Box>
  );
};

const LidoEthStaking = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const onPrimaryActionPress = useCallback(() => {
    navigation.navigate(RootRoutes.Modal, {
      screen: ModalRoutes.Staking,
      params: {
        screen: StakingRoutes.ETHStake,
        params: { source: EthStakingSource.Lido },
      },
    });
  }, [navigation]);
  return (
    <Modal
      hideSecondaryAction
      primaryActionTranslationId="action__lets_go"
      onPrimaryActionPress={onPrimaryActionPress}
      header={`${intl.formatMessage({ id: 'form__staking' })} ETH`}
      scrollViewProps={{
        children: <LidoEthStakingContent />,
      }}
    />
  );
};

export default LidoEthStaking;

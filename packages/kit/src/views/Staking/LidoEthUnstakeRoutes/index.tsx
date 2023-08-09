import { useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  CustomSkeleton,
  Image,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { getActiveWalletAccount, useAppSelector } from '../../../hooks/redux';
import { setStEthRate } from '../../../store/reducers/staking';
import { selectStakingStEthRate } from '../../../store/selectors';
import { formatAmount, multiply } from '../../Swap/utils';
import { fetchStEthRate } from '../utils';

import type { StakingRoutes, StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  StakingRoutesParams,
  StakingRoutes.LidoEthUnstakeRoutes
>;

const LidoEthUnstakeRoutes = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { source, onSelector, amount, networkId } = route.params;
  const [loading, setLoading] = useState(true);
  const rates = useAppSelector(selectStakingStEthRate);
  const stEthRate = useMemo(() => rates?.[networkId], [rates, networkId]);

  useEffect(() => {
    async function main() {
      const { account, networkId: activeNetworkId } = getActiveWalletAccount();
      if (account && activeNetworkId) {
        const res = await fetchStEthRate({
          networkId: activeNetworkId,
          account,
          amount,
        });
        const instantRate = res?.data?.instantRate;
        if (instantRate) {
          backgroundApiProxy.dispatch(
            setStEthRate({ networkId: activeNetworkId, value: instantRate }),
          );
          setLoading(false);
        }
      }
    }
    main();
  }, [amount]);

  return (
    <Modal footer={null} header={intl.formatMessage({ id: 'form__route' })}>
      <VStack space="4">
        <Pressable
          flexDirection="row"
          py="3"
          px="2"
          alignItems="center"
          justifyContent="space-between"
          bg={source === 'lido' ? 'surface-selected' : 'background-default'}
          borderRadius={12}
          onPress={() => onSelector?.('lido')}
        >
          <Box flexDirection="row" alignItems="center">
            <Image
              w="10"
              h="10"
              mr="3"
              source={require('@onekeyhq/kit/assets/staking/lido_pool.png')}
            />
            <Box flexDirection="column" justifyContent="space-between">
              <Typography.Body1Strong>Lido</Typography.Body1Strong>
              <Typography.Body2 color="text-subdued">
                {intl
                  .formatMessage({ id: 'form__str_day' }, { '0': '~ 1 - 3' })
                  .toLowerCase()}
              </Typography.Body2>
            </Box>
          </Box>
          <Box flexDirection="column" alignItems="flex-end">
            <Typography.Body1Strong color="text-success">
              {amount || '0'} ETH
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__you_receive' })}
            </Typography.Body2>
          </Box>
        </Pressable>
        <Pressable
          flexDirection="row"
          py="3"
          px="2"
          alignItems="center"
          justifyContent="space-between"
          bg={source === 'onekey' ? 'surface-selected' : 'background-default'}
          borderRadius={12}
          onPress={() => onSelector?.('onekey')}
        >
          <Box flexDirection="row" alignItems="center">
            <Image
              w="10"
              h="10"
              mr="3"
              source={require('@onekeyhq/kit/assets/logo_black.png')}
            />
            <Box flexDirection="column" justifyContent="space-between">
              <Typography.Body1Strong>OneKey Swap</Typography.Body1Strong>
              <Typography.Body2 color="text-subdued">
                {intl.formatMessage(
                  { id: 'content__str_minutes_plural' },
                  { '0': '~ 1-5' },
                )}
              </Typography.Body2>
            </Box>
          </Box>
          <Box flexDirection="column" alignItems="flex-end">
            {!amount ? (
              <Typography.Body1Strong color="text-success">
                0 ETH
              </Typography.Body1Strong>
            ) : (
              <Box>
                {stEthRate && !loading ? (
                  <Typography.Body1Strong color="text-success">
                    {formatAmount(multiply(stEthRate, amount), 6)} ETH
                  </Typography.Body1Strong>
                ) : (
                  <Box w="6" h="4" overflow="hidden" borderRadius={12}>
                    <CustomSkeleton />
                  </Box>
                )}
              </Box>
            )}
            <Typography.Body2 color="text-subdued">
              {intl.formatMessage({ id: 'form__you_receive' })}
            </Typography.Body2>
          </Box>
        </Pressable>
      </VStack>
    </Modal>
  );
};
export default LidoEthUnstakeRoutes;

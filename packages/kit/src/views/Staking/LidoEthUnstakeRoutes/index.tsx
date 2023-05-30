import { useEffect, useMemo } from 'react';

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
import {
  getActiveWalletAccount,
  useActiveWalletAccount,
  useAppSelector,
} from '../../../hooks/redux';
import { setStEthRate } from '../../../store/reducers/staking';
import { formatAmount } from '../../Swap/utils';
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
  const { source, onSelector } = route.params;
  const { networkId } = useActiveWalletAccount();
  const rates = useAppSelector((s) => s.staking.stEthRate);
  const stEthRate = useMemo(() => rates?.[networkId], [rates, networkId]);

  useEffect(() => {
    async function main() {
      const { account, networkId: activeNetworkId } = getActiveWalletAccount();
      if (account && activeNetworkId) {
        const res = await fetchStEthRate({
          networkId: activeNetworkId,
          account,
        });
        const instantRate = res?.data?.instantRate;
        if (instantRate) {
          backgroundApiProxy.dispatch(
            setStEthRate({ networkId: activeNetworkId, value: instantRate }),
          );
        }
      }
    }
    main();
  }, []);

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
          <Box flexDirection="row">
            <Typography.Body1Strong mr="1">
              {intl.formatMessage({ id: 'form__rate' })}
            </Typography.Body1Strong>
            <Typography.Body1Strong color="text-success">
              1:1
            </Typography.Body1Strong>
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
              source={require('@onekeyhq/kit/assets/logo.png')}
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
          <Box flexDirection="row" alignItems="center">
            <Typography.Body1Strong mr="1">
              {intl.formatMessage({ id: 'form__rate' })}
            </Typography.Body1Strong>
            {stEthRate ? (
              <Typography.Body1Strong color="text-success">
                1:{formatAmount(stEthRate, 6)}
              </Typography.Body1Strong>
            ) : (
              <Box w="6" h="4" overflow="hidden" borderRadius={12}>
                <CustomSkeleton />
              </Box>
            )}
          </Box>
        </Pressable>
      </VStack>
    </Modal>
  );
};
export default LidoEthUnstakeRoutes;

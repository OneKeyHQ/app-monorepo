import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal, VStack } from '@onekeyhq/components';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import { useAppSelector } from '../../../hooks';
import { formatAmount } from '../../../utils/priceUtils';
import { Options } from '../components/EthereumUtilsComponent';
import { EthStakingSource } from '../typing';

import type { StakingRoutes, StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.ETHPoolSelector>;

const ETHPool = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { networkId } = route.params;
  const ethStakingApr = useAppSelector((s) => s.staking.ethStakingApr);
  const items = useMemo(() => {
    if (!ethStakingApr) {
      return [];
    }
    const data =
      networkId === OnekeyNetwork.goerli
        ? ethStakingApr.testnet
        : ethStakingApr.mainnet;
    return [
      {
        name: EthStakingSource.Kele,
        num: data.kele,
        value: `${formatAmount(data.kele, 2)}%`,
        logo: require('@onekeyhq/kit/assets/staking/kele_pool.png'),
      },
      {
        name: EthStakingSource.Lido,
        num: data.lido,
        value: `${formatAmount(data.lido, 2)}%`,
        logo: require('@onekeyhq/kit/assets/staking/lido_pool.png'),
      },
    ].sort((a, b) => b.num - a.num);
  }, [networkId, ethStakingApr]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__str_pools' }, { '0': 'ETH' })}
      footer={null}
    >
      <VStack space={4}>
        {items.map((o) => (
          <Options
            key={o.name}
            title="ETH"
            subtitle={o.name}
            logo={o.logo}
            num={o.value}
            onPress={() => {
              route.params.onSelector?.(o.name);
            }}
          />
        ))}
      </VStack>
    </Modal>
  );
};

export default ETHPool;

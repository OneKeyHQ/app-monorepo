import { useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Modal, VStack } from '@onekeyhq/components';

import { useAppSelector } from '../../../hooks';
import { formatAmount } from '../../../utils/priceUtils';
import { Options } from '../components/StakingEthOptions';
import { EthStakingSource } from '../typing';

import type { StakingRoutes, StakingRoutesParams } from '../typing';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<StakingRoutesParams, StakingRoutes.ETHPoolSelector>;

const ETHPool = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { isTestnet } = route.params;
  const ethStakingApr = useAppSelector((s) => s.staking.ethStakingApr);
  const items = useMemo(() => {
    if (!ethStakingApr) {
      return [];
    }
    const data = isTestnet ? ethStakingApr.testnet : ethStakingApr.mainnet;
    return [
      {
        name: EthStakingSource.Kele,
        value: `${formatAmount(data.kele, 2)}%`,
        logo: require('@onekeyhq/kit/assets/staking/kele_pool.png'),
      },
      {
        name: EthStakingSource.Lido,
        value: `${formatAmount(data.lido, 2)}%`,
        logo: require('@onekeyhq/kit/assets/staking/lido_pool.png'),
      },
    ];
  }, [isTestnet, ethStakingApr]);

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

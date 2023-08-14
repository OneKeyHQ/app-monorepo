import type { FC } from 'react';
import { useContext, useMemo } from 'react';

import { Box, VStack, useUserDevice } from '@onekeyhq/components';

import { useAppSelector } from '../../../hooks';
import { StakingWidgets } from '../../Staking/Widgets/StakingWidgets';
import { TokenDetailContext } from '../context';

import { BalanceSection } from './BalanceSection';
import { ButtonsSection } from './ButtonsSections';
import { ChartSection } from './ChartSection';

const TokenDetailHeader: FC = () => {
  const { size } = useUserDevice();

  const showTokenDetailPriceChart = useAppSelector(
    (s) => s.settings.showTokenDetailPriceChart,
  );

  const context = useContext(TokenDetailContext);

  const content = useMemo(() => {
    if (size === 'SMALL') {
      return (
        <>
          <BalanceSection />
          <ButtonsSection />
          <StakingWidgets token={context?.detailInfo.defaultToken} />
        </>
      );
    }

    return (
      <>
        <ButtonsSection />
        {showTokenDetailPriceChart && context?.routeParams ? (
          <ChartSection {...context?.routeParams} />
        ) : null}
        <BalanceSection />
        <StakingWidgets token={context?.detailInfo.defaultToken} />
      </>
    );
  }, [
    size,
    showTokenDetailPriceChart,
    context?.routeParams,
    context?.detailInfo.defaultToken,
  ]);
  return (
    <VStack
      px={['NORMAL', 'LARGE'].includes(size) ? 8 : 4}
      space="6"
      bg="background-default"
    >
      {content}
    </VStack>
  );
};
export default TokenDetailHeader;

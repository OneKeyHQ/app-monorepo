import type { FC } from 'react';

import { VStack, useIsVerticalLayout } from '@onekeyhq/components';

import { BalanceSection } from './BalanceSection';
import { ButtonsSection } from './ButtonsSections';
import { ChartSection } from './ChartSection';

const TokenDetailHeader: FC = () => {
  const isVertical = useIsVerticalLayout();
  if (isVertical) {
    return (
      <VStack px={4} space={6}>
        <BalanceSection />
        <ButtonsSection />
        <ChartSection />
      </VStack>
    );
  }

  return (
    <VStack px={4} space={6}>
      <ButtonsSection />
      <ChartSection />
      <BalanceSection />
    </VStack>
  );
};
export default TokenDetailHeader;

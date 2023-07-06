import type { FC } from 'react';
import { useMemo } from 'react';

import { VStack, useIsVerticalLayout } from '@onekeyhq/components';

import { BalanceSection } from './BalanceSection';
import { ButtonsSection } from './ButtonsSections';
import { ChartSection } from './ChartSection';

const TokenDetailHeader: FC = () => {
  const isVertical = useIsVerticalLayout();
  const content = useMemo(() => {
    if (isVertical) {
      return (
        <>
          <BalanceSection />
          <ButtonsSection />
          <ChartSection />
        </>
      );
    }

    return (
      <>
        <ButtonsSection />
        <ChartSection />
        <BalanceSection />
      </>
    );
  }, [isVertical]);
  return (
    <VStack px="4" space="6" bg="background-default">
      {content}
    </VStack>
  );
};
export default TokenDetailHeader;

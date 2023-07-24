import type { FC } from 'react';
import { useMemo } from 'react';

import { VStack, useUserDevice } from '@onekeyhq/components';

import { BalanceSection } from './BalanceSection';
import { ButtonsSection } from './ButtonsSections';
// import { ChartSection } from './ChartSection';

const TokenDetailHeader: FC = () => {
  const { size } = useUserDevice();
  const content = useMemo(() => {
    if (size === 'SMALL') {
      return (
        <>
          <BalanceSection />
          <ButtonsSection />
          {/* <ChartSection /> */}
        </>
      );
    }

    return (
      <>
        <ButtonsSection />
        {/* <ChartSection /> */}
        <BalanceSection />
      </>
    );
  }, [size]);
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

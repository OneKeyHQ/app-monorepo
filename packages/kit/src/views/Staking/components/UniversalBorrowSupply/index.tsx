import type { ComponentProps } from 'react';

import { UniversalBorrowActionPrimary } from '../UniversalBorrowActionPrimary';

type IUniversalBorrowSupplyProps = Omit<
  ComponentProps<typeof UniversalBorrowActionPrimary>,
  | 'useBorrowApi'
  | 'borrowAction'
  | 'borrowMarketAddress'
  | 'borrowReserveAddress'
> & {
  borrowMarketAddress: string;
  borrowReserveAddress: string;
};

export function UniversalBorrowSupply(props: IUniversalBorrowSupplyProps) {
  return (
    <UniversalBorrowActionPrimary
      {...props}
      useBorrowApi
      borrowAction="supply"
    />
  );
}

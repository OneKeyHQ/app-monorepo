import type { ComponentProps } from 'react';

import { UniversalBorrowActionSecondary } from '../UniversalBorrowActionSecondary';

type IUniversalBorrowRepayProps = Omit<
  ComponentProps<typeof UniversalBorrowActionSecondary>,
  | 'useBorrowApi'
  | 'borrowAction'
  | 'borrowMarketAddress'
  | 'borrowReserveAddress'
> & {
  borrowMarketAddress: string;
  borrowReserveAddress: string;
};

export function UniversalBorrowRepay(props: IUniversalBorrowRepayProps) {
  return (
    <UniversalBorrowActionSecondary
      {...props}
      useBorrowApi
      borrowAction="repay"
    />
  );
}

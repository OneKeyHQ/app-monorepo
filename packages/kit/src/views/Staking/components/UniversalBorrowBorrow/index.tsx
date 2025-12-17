import type { ComponentProps } from 'react';

import { UniversalBorrowActionPrimary } from '../UniversalBorrowActionPrimary';

type IUniversalBorrowBorrowProps = Omit<
  ComponentProps<typeof UniversalBorrowActionPrimary>,
  | 'useBorrowApi'
  | 'borrowAction'
  | 'borrowMarketAddress'
  | 'borrowReserveAddress'
> & {
  borrowMarketAddress: string;
  borrowReserveAddress: string;
};

export function UniversalBorrowBorrow(props: IUniversalBorrowBorrowProps) {
  return (
    <UniversalBorrowActionPrimary
      {...props}
      useBorrowApi
      borrowAction="borrow"
    />
  );
}

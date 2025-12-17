import type { ComponentProps } from 'react';

import { UniversalBorrowActionSecondary } from '../UniversalBorrowActionSecondary';

type IUniversalBorrowWithdrawProps = Omit<
  ComponentProps<typeof UniversalBorrowActionSecondary>,
  | 'useBorrowApi'
  | 'borrowAction'
  | 'borrowMarketAddress'
  | 'borrowReserveAddress'
> & {
  borrowMarketAddress: string;
  borrowReserveAddress: string;
};

export function UniversalBorrowWithdraw(props: IUniversalBorrowWithdrawProps) {
  return (
    <UniversalBorrowActionSecondary
      {...props}
      useBorrowApi
      borrowAction="withdraw"
    />
  );
}

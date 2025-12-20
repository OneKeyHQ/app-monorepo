import { UniversalBorrowAction } from '../UniversalBorrowAction';

import type { IUniversalBorrowActionSecondaryProps } from '../UniversalBorrowAction';

type IUniversalBorrowRepayProps = Omit<
  IUniversalBorrowActionSecondaryProps,
  'useBorrowApi' | 'action' | 'borrowMarketAddress' | 'borrowReserveAddress'
> & {
  borrowMarketAddress: string;
  borrowReserveAddress: string;
};

export function UniversalBorrowRepay(props: IUniversalBorrowRepayProps) {
  return <UniversalBorrowAction {...props} useBorrowApi action="repay" />;
}

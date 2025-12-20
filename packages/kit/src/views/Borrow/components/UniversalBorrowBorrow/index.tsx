import { UniversalBorrowAction } from '../UniversalBorrowAction';

import type { IUniversalBorrowActionPrimaryProps } from '../UniversalBorrowAction';

type IUniversalBorrowBorrowProps = Omit<
  IUniversalBorrowActionPrimaryProps,
  'useBorrowApi' | 'action' | 'borrowMarketAddress' | 'borrowReserveAddress'
> & {
  borrowMarketAddress: string;
  borrowReserveAddress: string;
};

export function UniversalBorrowBorrow(props: IUniversalBorrowBorrowProps) {
  return <UniversalBorrowAction {...props} useBorrowApi action="borrow" />;
}

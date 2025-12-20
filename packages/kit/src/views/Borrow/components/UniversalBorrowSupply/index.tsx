import { UniversalBorrowAction } from '../UniversalBorrowAction';

import type { IUniversalBorrowActionPrimaryProps } from '../UniversalBorrowAction';

type IUniversalBorrowSupplyProps = Omit<
  IUniversalBorrowActionPrimaryProps,
  'useBorrowApi' | 'action' | 'borrowMarketAddress' | 'borrowReserveAddress'
> & {
  borrowMarketAddress: string;
  borrowReserveAddress: string;
};

export function UniversalBorrowSupply(props: IUniversalBorrowSupplyProps) {
  return <UniversalBorrowAction {...props} useBorrowApi action="supply" />;
}

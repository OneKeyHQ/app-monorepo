import { UniversalBorrowAction } from '../UniversalBorrowAction';

import type { IUniversalBorrowActionSecondaryProps } from '../UniversalBorrowAction';

type IUniversalBorrowWithdrawProps = Omit<
  IUniversalBorrowActionSecondaryProps,
  'useBorrowApi' | 'action' | 'borrowMarketAddress' | 'borrowReserveAddress'
> & {
  borrowMarketAddress: string;
  borrowReserveAddress: string;
};

export function UniversalBorrowWithdraw(props: IUniversalBorrowWithdrawProps) {
  return <UniversalBorrowAction {...props} useBorrowApi action="withdraw" />;
}

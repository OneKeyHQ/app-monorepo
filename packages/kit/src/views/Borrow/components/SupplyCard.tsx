import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useBorrowContext } from '../BorrowProvider';

import {
  AmountField,
  AssetField,
  BorrowAPYField,
  BorrowTableList,
} from './BorrowTableList';
import { Card } from './Card';

export const SupplyCard = () => {
  const { reserves } = useBorrowContext();

  // FIXME[borrow]: i18n
  return (
    <Card title="Assets to supply">
      <BorrowTableList<IBorrowReserveItem['supply']['assets'][number]>
        data={reserves?.supply.assets || []}
        columns={[
          {
            label: 'Asset / Can be collateral',
            key: 'asset',
            render: AssetField,
            flex: 1.5,
          },
          {
            label: 'Balance',
            align: 'flex-end',
            key: 'balance',
            render: (item) => (
              <AmountField
                title={item.walletBalance.title}
                description={item.walletBalance.description}
              />
            ),
            flex: 1,
          },
          {
            label: 'Supply APY',
            align: 'flex-end',
            key: 'supplyApy',
            render: BorrowAPYField,
            flex: 1,
          },
        ]}
        emptyContent="Nothing supplied yet"
      />
    </Card>
  );
};

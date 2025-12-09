import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useBorrowContext } from '../BorrowProvider';

import { AssetField, BorrowTableList } from './BorrowTableList';
import { Card } from './Card';

export const BorrowCard = () => {
  const { reserves } = useBorrowContext();

  // FIXME[borrow]: i18n
  return (
    <Card title="Assets to borrow">
      <BorrowTableList<IBorrowReserveItem['borrow']['assets'][number]>
        data={reserves?.borrow.assets || []}
        columns={[
          {
            label: 'Asset',
            key: 'asset',
            render: AssetField,
            flex: 1,
          },
        ]}
        emptyContent="Nothing supplied yet"
      />
    </Card>
  );
};

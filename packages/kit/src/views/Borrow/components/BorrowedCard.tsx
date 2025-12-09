import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useBorrowContext } from '../BorrowProvider';

import { AssetField, BorrowTableList } from './BorrowTableList';
import { Card } from './Card';

export const BorrowedCard = () => {
  const { reserves } = useBorrowContext();

  // FIXME[borrow]: i18n
  return (
    <Card title="Your borrows">
      <BorrowTableList<IBorrowReserveItem['borrowed']['assets'][number]>
        data={reserves?.borrowed.assets || []}
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

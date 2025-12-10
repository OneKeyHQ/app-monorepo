import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useBorrowContext } from '../BorrowProvider';

import { AssetField, BorrowTableList } from './BorrowTableList';
import { Card } from './Card';

export const BorrowCard = () => {
  const { reserves } = useBorrowContext();

  // FIXME[borrow]: i18n
  return (
    <Card title="Assets to borrow">
      {/* FIXME[borrow]: i18n */}
      <BorrowTableList<IBorrowReserveItem['borrow']['assets'][number]>
        data={reserves?.borrow.assets || []}
        columns={[
          {
            label: 'Asset', // FIXME[borrow]: i18n
            key: 'asset',
            render: AssetField,
            flex: 1,
          },
        ]}
        emptyContent="Nothing supplied yet" // FIXME[borrow]: i18n
      />
    </Card>
  );
};

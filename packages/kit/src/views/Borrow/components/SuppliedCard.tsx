import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useBorrowContext } from '../BorrowProvider';

import { AssetField, BorrowTableList } from './BorrowTableList';
import { Card } from './Card';

export const SuppliedCard = () => {
  const { reserves } = useBorrowContext();

  // FIXME[borrow]: i18n
  return (
    <Card title="Your supplies">
      {/* FIXME[borrow]: i18n */}
      <BorrowTableList<IBorrowReserveItem['supplied']['assets'][number]>
        data={reserves?.supplied.assets || []}
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

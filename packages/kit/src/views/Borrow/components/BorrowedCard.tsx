import { useCallback } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { useBorrowContext } from '../BorrowProvider';
import { useSupplyActions } from '../hooks/useSupplyActions';

import {
  ActionField,
  AmountField,
  AssetField,
  BorrowAPYField,
  BorrowTableList,
} from './BorrowTableList';
import { Card } from './Card';

export type IBorrowedAsset = IBorrowReserveItem['borrowed']['assets'][number];

export const BorrowedCard = () => {
  const { reserves } = useBorrowContext();

  // FIXME[borrow]: i18n
  return (
    <Card title="Your borrows">
      {/* FIXME[borrow]: i18n */}
      <BorrowTableList<IBorrowedAsset>
        data={reserves?.borrowed.assets || []}
        columns={[
          {
            label: 'Asset', // FIXME[borrow]: i18n
            key: 'asset',
            render: AssetField,
            flex: 1,
          },
          {
            label: 'Borrowed',
            align: 'flex-end',
            key: 'borrowed',
            render: (item) => (
              <AmountField
                title={item.borrowedAmount.title}
                description={item.borrowedAmount.description}
              />
            ),
            flex: 1,
          },
          {
            label: 'Borrow APY',
            align: 'flex-end',
            key: 'borrowAPY',
            render: BorrowAPYField,
            flex: 1,
          },
          {
            label: '',
            align: 'flex-end',
            key: 'actions',
            render: (item) => (
              <ActionField
                buttonText={<EarnText text={{ text: 'Repay' }} />}
                item={item}
              />
            ),
            flex: 1,
          },
        ]}
        emptyContent="Nothing supplied yet" // FIXME[borrow]: i18n
      />
    </Card>
  );
};

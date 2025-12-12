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

type IBorrowAsset = IBorrowReserveItem['borrow']['assets'][number];

export const BorrowCard = () => {
  const { reserves } = useBorrowContext();

  // FIXME[borrow]: i18n
  return (
    <Card title="Assets to borrow">
      {/* FIXME[borrow]: i18n */}
      <BorrowTableList<IBorrowAsset>
        data={reserves?.borrow.assets || []}
        columns={[
          {
            label: 'Asset', // FIXME[borrow]: i18n
            key: 'asset',
            render: AssetField,
            flex: 1,
          },
          {
            label: 'Available',
            align: 'flex-end',
            key: 'available',
            render: (item) => (
              <AmountField
                title={item.available.title}
                description={item.available.description}
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
          {
            label: '',
            align: 'flex-end',
            key: 'actions',
            render: (item) => (
              <ActionField
                buttonText={<EarnText text={{ text: 'Borrow' }} />}
                item={item}
                onPress={() => {}}
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

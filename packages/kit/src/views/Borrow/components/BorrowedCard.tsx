import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EManagePositionType } from '../../Staking/pages/ManagePosition/hooks/useManagePage';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';
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
  const { reserves, market, reservesLoading } = useBorrowContext();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const handleManageRepay = useCallback(
    (item: IBorrowedAsset) => {
      if (!market) return;

      BorrowNavigation.pushToBorrowManagePosition(navigation, {
        accountId: activeAccount.account?.id || '',
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: item.reserveAddress,
        symbol: item.token.symbol,
        logoURI: item.token.logoURI,
        type: EManagePositionType.Repay,
        borrowReserves: reserves ?? undefined,
      });
    },
    [navigation, market, activeAccount.account?.id, reserves],
  );

  const showLoading = !reserves && reservesLoading;

  // FIXME[borrow]: i18n
  return (
    <Card title="Your borrows">
      {/* FIXME[borrow]: i18n */}
      <BorrowTableList<IBorrowedAsset>
        data={reserves?.borrowed.assets || []}
        isLoading={showLoading}
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
                onPress={() => handleManageRepay(item)}
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

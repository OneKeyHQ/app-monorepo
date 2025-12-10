import { useCallback } from 'react';

import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';

import {
  AmountField,
  AssetField,
  BorrowAPYField,
  BorrowTableList,
} from './BorrowTableList';
import { Card } from './Card';

type ISupplyAsset = IBorrowReserveItem['supply']['assets'][number];

export const SupplyCard = () => {
  const { reserves, market } = useBorrowContext();
  const navigation = useAppNavigation();

  const handlePressRow = useCallback(
    (item: ISupplyAsset) => {
      if (!market) return;
      BorrowNavigation.pushToBorrowReserveDetails(navigation, {
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: item.reserveAddress,
        symbol: item.token.symbol,
        logoURI: item.token.logoURI,
      });
    },
    [navigation, market],
  );

  return (
    <Card title="Assets to supply">
      <BorrowTableList<ISupplyAsset>
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
        onPressRow={handlePressRow}
        emptyContent="Nothing supplied yet"
      />
    </Card>
  );
};

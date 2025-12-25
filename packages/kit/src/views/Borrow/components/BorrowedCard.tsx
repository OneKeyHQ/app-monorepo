import { useCallback, useMemo } from 'react';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EManagePositionType } from '../../Staking/pages/ManagePosition/hooks/useManagePage';
import { useBorrowContext } from '../BorrowProvider';
import { BorrowNavigation } from '../borrowUtils';

import {
  ActionField,
  AmountField,
  AssetField,
  AssetWithAmountField,
  BorrowAPYField,
  BorrowTableList,
} from './BorrowTableList';
import { Card } from './Card';

export type IBorrowedAsset = IBorrowReserveItem['borrowed']['assets'][number];

export const BorrowedCard = () => {
  const { reserves, market, reservesLoading } = useBorrowContext();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { gtMd } = useMedia();

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
        providerLogoURI: market.logoURI,
        logoURI: item.token.logoURI,
        type: EManagePositionType.Repay,
        borrowReserves: reserves ?? undefined,
      });
    },
    [navigation, market, activeAccount.account?.id, reserves],
  );

  const handlePressRow = useCallback(
    (item: IBorrowedAsset) => {
      if (!market) return;
      if (gtMd) {
        // Desktop: navigate to details page
        BorrowNavigation.pushToBorrowReserveDetails(navigation, {
          networkId: market.networkId,
          provider: market.provider,
          marketAddress: market.marketAddress,
          reserveAddress: item.reserveAddress,
          symbol: item.token.symbol,
          logoURI: item.token.logoURI,
        });
      } else {
        // Mobile: open Repay dialog
        handleManageRepay(item);
      }
    },
    [navigation, market, gtMd, handleManageRepay],
  );

  const showLoading = !reserves && reservesLoading;

  // Mobile columns - 2 columns only
  const mobileColumns = useMemo(
    () => [
      {
        label: 'Asset / Borrowed',
        key: 'asset',
        render: (item: IBorrowedAsset) => (
          <AssetWithAmountField
            token={item.token}
            amountLabel="Borrowed:"
            amount={item.borrowedAmount.title}
            amountDescription={item.borrowedAmount.description}
          />
        ),
        flex: 1.5,
      },
      {
        label: 'Borrow APY',
        align: 'flex-end' as const,
        key: 'borrowApy',
        render: BorrowAPYField,
        flex: 1,
      },
    ],
    [],
  );

  // Desktop columns - all columns
  const desktopColumns = useMemo(
    () => [
      {
        label: 'Asset', // FIXME[borrow]: i18n
        key: 'asset',
        render: AssetField,
        flex: 1,
      },
      {
        label: 'Borrowed',
        align: 'flex-end' as const,
        key: 'borrowed',
        render: (item: IBorrowedAsset) => (
          <AmountField
            title={item.borrowedAmount.title}
            description={item.borrowedAmount.description}
          />
        ),
        flex: 1,
      },
      {
        label: 'Borrow APY',
        align: 'flex-end' as const,
        key: 'borrowAPY',
        render: BorrowAPYField,
        flex: 1,
      },
      {
        label: '',
        align: 'flex-end' as const,
        key: 'actions',
        render: (item: IBorrowedAsset) => (
          <ActionField
            buttonText={<EarnText text={{ text: 'Repay' }} />}
            item={item}
            onPress={() => handleManageRepay(item)}
          />
        ),
        flex: 1,
      },
    ],
    [handleManageRepay],
  );

  // FIXME[borrow]: i18n
  return (
    <Card title="Your borrows">
      {/* FIXME[borrow]: i18n */}
      <BorrowTableList<IBorrowedAsset>
        data={reserves?.borrowed.assets || []}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={handlePressRow}
        emptyContent="Supply assets as collateral before borrowing" // FIXME[borrow]: i18n
      />
    </Card>
  );
};

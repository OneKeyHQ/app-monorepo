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

type IBorrowAsset = IBorrowReserveItem['borrow']['assets'][number];

export const BorrowCard = () => {
  const { reserves, market, reservesLoading } = useBorrowContext();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const { gtMd } = useMedia();

  const handlePressRow = useCallback(
    (item: IBorrowAsset) => {
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

  const handleManageBorrow = useCallback(
    (item: IBorrowAsset) => {
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
        type: EManagePositionType.Borrow,
        borrowReserves: reserves ?? undefined,
      });
    },
    [navigation, market, activeAccount.account?.id, reserves],
  );

  const showLoading = !reserves && reservesLoading;

  // Mobile columns - 2 columns only
  const mobileColumns = useMemo(
    () => [
      {
        label: 'Asset / Available',
        key: 'asset',
        render: (item: IBorrowAsset) => (
          <AssetWithAmountField
            token={item.token}
            amountLabel="Available:"
            amount={item.available.title}
            amountDescription={item.available.description}
          />
        ),
        flex: 1.5,
      },
      {
        label: 'Supply APY',
        align: 'flex-end' as const,
        key: 'supplyApy',
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
        label: 'Available',
        align: 'flex-end' as const,
        key: 'available',
        render: (item: IBorrowAsset) => (
          <AmountField
            title={item.available.title}
            description={item.available.description}
          />
        ),
        flex: 1,
      },
      {
        label: 'Supply APY',
        align: 'flex-end' as const,
        key: 'supplyApy',
        render: BorrowAPYField,
        flex: 1,
      },
      {
        label: '',
        align: 'flex-end' as const,
        key: 'actions',
        render: (item: IBorrowAsset) => (
          <ActionField
            buttonText={<EarnText text={{ text: 'Borrow' }} />}
            item={item}
            onPress={() => handleManageBorrow(item)}
          />
        ),
        flex: 1,
      },
    ],
    [handleManageBorrow],
  );

  // FIXME[borrow]: i18n
  return (
    <Card title="Assets to borrow">
      {/* FIXME[borrow]: i18n */}
      <BorrowTableList<IBorrowAsset>
        data={reserves?.borrow.assets || []}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={handlePressRow}
        emptyContent="Nothing supplied yet" // FIXME[borrow]: i18n
      />
    </Card>
  );
};

import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EManagePositionType } from '../../Staking/pages/ManagePosition/hooks/useManagePage';
import { EBorrowDataStatus } from '../borrowDataStatus';
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
  const { reserves, market, borrowDataStatus, earnAccount } =
    useBorrowContext();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const accountId = earnAccount.data?.account?.id || '';
  const walletId = earnAccount.data?.walletId || '';
  const indexedAccountId = earnAccount.data?.account?.indexedAccountId;

  const handleManageBorrow = useCallback(
    (item: IBorrowAsset) => {
      if (!market) return;

      BorrowNavigation.pushToBorrowManagePosition(navigation, {
        accountId,
        networkId: market.networkId,
        provider: market.provider,
        marketAddress: market.marketAddress,
        reserveAddress: item.reserveAddress,
        symbol: item.token.symbol,
        providerLogoURI: market.logoURI,
        logoURI: item.token.logoURI,
        type: EManagePositionType.Borrow,
      });
    },
    [navigation, market, accountId],
  );

  const handlePressRow = useCallback(
    (item: IBorrowAsset) => {
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
          accountId: accountId || undefined,
          indexedAccountId,
        });
      } else {
        // Mobile: block disabled borrow assets (e.g. already supplied)
        if (item.borrowButton?.disabled) return;
        handleManageBorrow(item);
      }
    },
    [navigation, market, gtMd, handleManageBorrow, accountId, indexedAccountId],
  );

  const showLoading =
    borrowDataStatus === EBorrowDataStatus.LoadingMarkets ||
    borrowDataStatus === EBorrowDataStatus.WaitingForAccount ||
    borrowDataStatus === EBorrowDataStatus.LoadingReserves;

  // Per-row disabled state: dim + block tap for disabled borrow assets on mobile.
  // Desktop rows navigate to details (still useful), so only mobile rows are disabled.
  const getListItemProps = useCallback(
    (item: IBorrowAsset) => {
      if (gtMd) return undefined;
      return item.borrowButton?.disabled ? { disabled: true } : undefined;
    },
    [gtMd],
  );

  const borrowListProps = useMemo(
    () => ({ listItemProps: getListItemProps }),
    [getListItemProps],
  );

  const labels = useMemo(() => {
    const asset = intl.formatMessage({ id: ETranslations.global_asset });
    const available = intl.formatMessage({
      id: ETranslations.global_available,
    });
    return {
      asset,
      available,
      borrowApy: intl.formatMessage({ id: ETranslations.defi_borrow_apy }),
      borrow: intl.formatMessage({ id: ETranslations.global_borrow }),
      assetsToBorrow: intl.formatMessage({
        id: ETranslations.defi_assets_to_borrow,
      }),
      noAssetsToBorrow: intl.formatMessage({
        id: ETranslations.defi_no_assets_to_borrow,
      }),
      assetAvailable: `${asset} / ${available}`,
      availableWithColon: `${available}:`,
    };
  }, [intl]);

  // Mobile columns - 2 columns only
  const mobileColumns = useMemo(
    () => [
      {
        label: labels.assetAvailable,
        key: 'asset',
        render: (item: IBorrowAsset) => (
          <AssetWithAmountField
            token={item.token}
            amountLabel={{ text: labels.availableWithColon }}
            amount={item.available.title}
            amountDescription={item.available.description}
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1.5,
      },
      {
        label: labels.borrowApy,
        align: 'flex-end' as const,
        key: 'supplyApy',
        render: BorrowAPYField,
        flex: 1,
      },
    ],
    [labels],
  );

  // Desktop columns - all columns
  const desktopColumns = useMemo(
    () => [
      {
        label: labels.asset,
        key: 'asset',
        render: (item: IBorrowAsset) => (
          <AssetField
            token={item.token}
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1,
      },
      {
        label: labels.available,
        align: 'flex-end' as const,
        key: 'available',
        sortable: true,
        comparator: (a: IBorrowAsset, b: IBorrowAsset) => {
          const aFiatValue = new BigNumber(a.available?.fiatValue || '0');
          const bFiatValue = new BigNumber(b.available?.fiatValue || '0');
          return aFiatValue.comparedTo(bFiatValue);
        },
        render: (item: IBorrowAsset) => (
          <AmountField
            title={item.available.title}
            description={item.available.description}
          />
        ),
        flex: 1,
      },
      {
        label: labels.borrowApy,
        align: 'flex-end' as const,
        key: 'borrowApy',
        render: BorrowAPYField,
        flex: 1,
      },
      {
        label: '',
        align: 'flex-end' as const,
        key: 'actions',
        render: (item: IBorrowAsset) => (
          <ActionField
            buttonText={<EarnText text={{ text: labels.borrow }} />}
            item={item}
            accountId={accountId}
            walletId={walletId}
            indexedAccountId={indexedAccountId}
            onPress={() => handleManageBorrow(item)}
            disabled={item.borrowButton?.disabled}
          />
        ),
        flex: 1,
      },
    ],
    [handleManageBorrow, accountId, walletId, indexedAccountId, labels],
  );

  return (
    <Card title={labels.assetsToBorrow}>
      <BorrowTableList<IBorrowAsset>
        data={reserves.data?.borrow?.assets || []}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={handlePressRow}
        emptyContent={labels.noAssetsToBorrow}
        defaultSortKey="available"
        defaultSortDirection="desc"
        listProps={borrowListProps}
      />
    </Card>
  );
};

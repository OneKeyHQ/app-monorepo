import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { XStack, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
import { useEarnAccount } from '../../Staking/hooks/useEarnAccount';
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

const BorrowedHeader = ({
  data,
  borrowedBalanceLabel,
  apyLabel,
}: {
  data?: IBorrowReserveItem['borrowed'];
  borrowedBalanceLabel: string;
  apyLabel: string;
}) => {
  return (
    <XStack mt="$3" mb="$5" px="$5" gap="$5">
      {data?.borrowedBalance?.title ? (
        <XStack gap="$1" ai="center">
          <EarnText
            text={{
              text: borrowedBalanceLabel,
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnText text={data?.borrowedBalance?.title} />
        </XStack>
      ) : null}
      {data?.borrowedApy?.title ? (
        <XStack gap="$1" ai="center">
          <EarnText
            text={{
              text: apyLabel,
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnText text={data?.borrowedApy?.title} />
          <EarnTooltip tooltip={data?.borrowedApy?.tooltip} />
        </XStack>
      ) : null}
    </XStack>
  );
};

export const BorrowedCard = () => {
  const { reserves, market, reservesLoading } = useBorrowContext();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { earnAccount } = useEarnAccount({ networkId: market?.networkId });
  const { gtMd } = useMedia();
  const accountId = earnAccount?.account?.id || '';
  const walletId = earnAccount?.walletId || '';
  const indexedAccountId = earnAccount?.account?.indexedAccountId;

  const handleManageRepay = useCallback(
    (item: IBorrowedAsset) => {
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
        type: EManagePositionType.Repay,
        borrowReserves: reserves ?? undefined,
      });
    },
    [navigation, market, accountId, reserves],
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

  const labels = useMemo(() => {
    const asset = intl.formatMessage({ id: ETranslations.global_asset });
    const borrowed = intl.formatMessage({
      id: ETranslations.wallet_defi_asset_type_borrowed,
    });
    const balance = intl.formatMessage({ id: ETranslations.global_balance });
    return {
      asset,
      borrowed,
      borrowedBalance: `${borrowed} ${balance}`,
      borrowApy: intl.formatMessage({ id: ETranslations.defi_borrow_apy }),
      apy: intl.formatMessage({ id: ETranslations.global_apy }),
      assetBorrowed: `${asset} / ${borrowed}`,
      borrowedWithColon: `${borrowed}:`,
    };
  }, [intl]);

  // Mobile columns - 2 columns only
  const mobileColumns = useMemo(
    () => [
      {
        label: labels.assetBorrowed,
        key: 'asset',
        render: (item: IBorrowedAsset) => (
          <AssetWithAmountField
            token={item.token}
            amountLabel={{ text: labels.borrowedWithColon }}
            amount={item.borrowedAmount.title}
            amountDescription={item.borrowedAmount.description}
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1.5,
      },
      {
        label: labels.borrowApy,
        align: 'flex-end' as const,
        key: 'borrowApy',
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
        render: (item: IBorrowedAsset) => (
          <AssetField
            token={item.token}
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1,
      },
      {
        label: labels.borrowed,
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
        label: labels.borrowApy,
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
            buttonText={
              <EarnText
                text={{
                  text: intl.formatMessage({ id: ETranslations.defi_repay }),
                }}
              />
            }
            item={item}
            accountId={accountId}
            walletId={walletId}
            indexedAccountId={indexedAccountId}
            onPress={() => handleManageRepay(item)}
            disabled={item.repayButton?.disabled}
          />
        ),
        flex: 1,
      },
    ],
    [handleManageRepay, accountId, walletId, indexedAccountId, labels, intl],
  );

  const hasData = useMemo(
    () => (reserves?.borrowed?.assets || []).length > 0,
    [reserves?.borrowed?.assets],
  );

  return (
    <Card
      title={intl.formatMessage({ id: ETranslations.defi_my_borrow })}
      renderHeader={
        !showLoading && hasData ? (
          <BorrowedHeader
            data={reserves?.borrowed}
            borrowedBalanceLabel={labels.borrowedBalance}
            apyLabel={labels.apy}
          />
        ) : null
      }
    >
      <BorrowTableList<IBorrowedAsset>
        data={reserves?.borrowed?.assets || []}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={handlePressRow}
        emptyContent={intl.formatMessage({
          id: ETranslations.defi_supply_assets_as_collateral_before_borrowing,
        })}
      />
    </Card>
  );
};

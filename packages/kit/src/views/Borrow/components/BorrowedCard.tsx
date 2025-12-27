import { useCallback, useMemo } from 'react';

import { XStack, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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
}: {
  data?: IBorrowReserveItem['borrowed'];
}) => {
  return (
    <XStack mt="$3" mb="$5" px="$5" gap="$5">
      {data?.borrowedBalance?.title ? (
        <XStack gap="$1" ai="center">
          <EarnText
            text={{
              text: 'Borrowed balance',
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
              text: 'APY',
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
    [handleManageRepay, accountId, walletId, indexedAccountId],
  );

  // FIXME[borrow]: i18n
  return (
    <Card
      title="My borrow"
      renderHeader={
        !showLoading ? <BorrowedHeader data={reserves?.borrowed} /> : null
      }
    >
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

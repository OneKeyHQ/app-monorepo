import { useCallback, useMemo } from 'react';

import { XStack, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
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

type ISuppliedAsset = IBorrowReserveItem['supplied']['assets'][number];

const SuppliedHeader = ({
  data,
}: {
  data?: IBorrowReserveItem['supplied'];
}) => {
  return (
    <XStack mt="$3" mb="$5" px="$5" gap="$5">
      {data?.suppliedBalance?.title ? (
        <XStack gap="$1">
          <EarnText
            text={{
              text: 'Supplied balance',
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnText text={data?.suppliedBalance?.title} />
        </XStack>
      ) : null}
      {data?.suppliedApy?.title ? (
        <XStack gap="$1">
          <EarnText
            text={{
              text: 'APY',
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnText text={data?.suppliedApy?.title} />
        </XStack>
      ) : null}
    </XStack>
  );
};

export const SuppliedCard = () => {
  const { reserves, market, reservesLoading } = useBorrowContext();
  const navigation = useAppNavigation();
  const { earnAccount } = useEarnAccount({ networkId: market?.networkId });
  const { gtMd } = useMedia();
  const accountId = earnAccount?.account?.id || '';
  const walletId = earnAccount?.walletId || '';
  const indexedAccountId = earnAccount?.account?.indexedAccountId;

  const handleManageWithdraw = useCallback(
    (item: ISuppliedAsset) => {
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
        type: EManagePositionType.Withdraw,
        borrowReserves: reserves ?? undefined,
      });
    },
    [navigation, market, accountId, reserves],
  );

  const handlePressRow = useCallback(
    (item: ISuppliedAsset) => {
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
        // Mobile: open Withdraw dialog
        handleManageWithdraw(item);
      }
    },
    [navigation, market, gtMd, handleManageWithdraw],
  );

  const showLoading = !reserves && reservesLoading;

  // Mobile columns - 2 columns only
  const mobileColumns = useMemo(
    () => [
      {
        label: 'Asset / Supplied',
        key: 'asset',
        render: (item: ISuppliedAsset) => (
          <AssetWithAmountField
            token={item.token}
            amountLabel="Supplied:"
            amount={item.suppliedAmount.title}
            amountDescription={item.suppliedAmount.description}
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
        label: 'Asset',
        key: 'asset',
        render: AssetField,
        flex: 1,
      },
      {
        label: 'Supplied',
        align: 'flex-end' as const,
        key: 'supplied',
        render: (item: ISuppliedAsset) => (
          <AmountField
            title={item.suppliedAmount.title}
            description={item.suppliedAmount.description}
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
        render: (item: ISuppliedAsset) => (
          <ActionField
            buttonText={<EarnText text={{ text: 'Withdraw' }} />}
            item={item}
            accountId={accountId}
            walletId={walletId}
            indexedAccountId={indexedAccountId}
            onPress={() => handleManageWithdraw(item)}
            disabled={item.withdrawButton?.disabled}
          />
        ),
        flex: 1,
      },
    ],
    [handleManageWithdraw, accountId, walletId, indexedAccountId],
  );

  // FIXME[borrow]: i18n
  return (
    <Card title="My supply">
      {/* FIXME[borrow]: i18n */}
      {!showLoading ? <SuppliedHeader data={reserves?.supplied} /> : null}
      <BorrowTableList<ISuppliedAsset>
        data={reserves?.supplied.assets || []}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={handlePressRow}
        emptyContent="Nothing supplied yet" // FIXME[borrow]: i18n
      />
    </Card>
  );
};

import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { XStack, useMedia } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { EarnText } from '../../Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '../../Staking/components/ProtocolDetails/EarnTooltip';
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

type ISuppliedAsset = IBorrowReserveItem['supplied']['assets'][number];

const SuppliedHeader = ({
  data,
  suppliedBalanceLabel,
  apyLabel,
  isDesktop,
}: {
  data?: IBorrowReserveItem['supplied'];
  suppliedBalanceLabel: string;
  apyLabel: string;
  isDesktop?: boolean;
}) => {
  return (
    <XStack mt="$3" mb={isDesktop ? '$3' : '$2'} px="$5" gap="$5">
      {data?.suppliedBalance?.title ? (
        <XStack gap="$1" ai="center">
          <EarnText
            text={{
              text: suppliedBalanceLabel,
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnText text={data?.suppliedBalance?.title} size="$bodyMdMedium" />
        </XStack>
      ) : null}
      {data?.suppliedApy?.title ? (
        <XStack gap="$1" ai="center">
          <EarnText
            text={{
              text: apyLabel,
              size: '$bodyMd',
              color: '$textSubdued',
            }}
          />
          <EarnText text={data?.suppliedApy?.title} size="$bodyMdMedium" />
          <EarnTooltip tooltip={data?.suppliedApy?.tooltip} />
        </XStack>
      ) : null}
    </XStack>
  );
};

export const SuppliedCard = () => {
  const { reserves, market, borrowDataStatus, earnAccount } =
    useBorrowContext();
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { gtMd } = useMedia();
  const accountId = earnAccount.data?.account?.id || '';
  const walletId = earnAccount.data?.walletId || '';
  const indexedAccountId = earnAccount.data?.account?.indexedAccountId;

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
      });
    },
    [navigation, market, accountId],
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
          accountId: accountId || undefined,
          indexedAccountId,
        });
      } else {
        // Mobile: open Withdraw dialog
        handleManageWithdraw(item);
      }
    },
    [
      navigation,
      market,
      gtMd,
      handleManageWithdraw,
      accountId,
      indexedAccountId,
    ],
  );

  const showLoading =
    borrowDataStatus === EBorrowDataStatus.LoadingMarkets ||
    borrowDataStatus === EBorrowDataStatus.WaitingForAccount ||
    borrowDataStatus === EBorrowDataStatus.LoadingReserves;

  const labels = useMemo(() => {
    const asset = intl.formatMessage({ id: ETranslations.global_asset });
    const supplied = intl.formatMessage({
      id: ETranslations.wallet_defi_asset_type_supplied,
    });
    return {
      asset,
      supplied,
      suppliedBalance: intl.formatMessage({
        id: ETranslations.defi_supplied_balance,
      }),
      supplyApy: intl.formatMessage({ id: ETranslations.defi_supply_apy }),
      withdraw: intl.formatMessage({ id: ETranslations.global_withdraw }),
      apy: intl.formatMessage({ id: ETranslations.global_apy }),
      assetSupplied: `${asset} / ${supplied}`,
      suppliedWithColon: `${supplied}:`,
    };
  }, [intl]);

  // Mobile columns - 2 columns only
  const mobileColumns = useMemo(
    () => [
      {
        label: labels.assetSupplied,
        key: 'asset',
        render: (item: ISuppliedAsset) => (
          <AssetWithAmountField
            token={item.token}
            amountLabel={{ text: labels.suppliedWithColon }}
            amount={item.suppliedAmount.title}
            amountDescription={item.suppliedAmount.description}
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1.5,
      },
      {
        label: labels.supplyApy,
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
        render: (item: ISuppliedAsset) => (
          <AssetField
            token={item.token}
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1,
      },
      {
        label: labels.supplied,
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
        label: labels.supplyApy,
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
            buttonText={<EarnText text={{ text: labels.withdraw }} />}
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
    [handleManageWithdraw, accountId, walletId, indexedAccountId, labels],
  );

  const hasData = useMemo(
    () => (reserves.data?.supplied?.assets || []).length > 0,
    [reserves.data?.supplied?.assets],
  );

  return (
    <Card
      title={intl.formatMessage({ id: ETranslations.defi_my_supply })}
      renderHeader={
        !showLoading && hasData ? (
          <SuppliedHeader
            data={reserves.data?.supplied}
            suppliedBalanceLabel={labels.suppliedBalance}
            apyLabel={labels.apy}
            isDesktop={gtMd}
          />
        ) : null
      }
    >
      <BorrowTableList<ISuppliedAsset>
        data={reserves.data?.supplied?.assets || []}
        isLoading={showLoading}
        columns={gtMd ? desktopColumns : mobileColumns}
        onPressRow={handlePressRow}
        emptyContent={intl.formatMessage({
          id: ETranslations.defi_nothing_supplied_yet,
        })}
      />
    </Card>
  );
};

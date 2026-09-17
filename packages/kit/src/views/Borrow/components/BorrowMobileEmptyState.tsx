import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { BorrowTestIDs } from '../testIDs';

import { pickTopSupplyAssetsByBalance } from './borrowEmptyState.utils';
import { BorrowRefreshButton } from './BorrowRefreshButton';
import {
  AssetWithAmountField,
  BorrowAPYField,
  BorrowTableList,
} from './BorrowTableList';

type ISupplyAsset = IBorrowReserveItem['supply']['assets'][number];

type IBorrowMobileEmptyStateProps = {
  assets?: ISupplyAsset[];
  isLoading?: boolean;
  onPressAsset?: (asset: ISupplyAsset) => void;
  /** The headline metrics that normally carry refresh are not on screen here,
   * so this heading is what holds it instead. */
  onRefresh?: () => void;
  isRefreshing?: boolean;
};

export function BorrowMobileEmptyState({
  assets,
  isLoading,
  onPressAsset,
  onRefresh,
  isRefreshing,
}: IBorrowMobileEmptyStateProps) {
  const intl = useIntl();
  const topAssets = useMemo(
    () => pickTopSupplyAssetsByBalance(assets),
    [assets],
  );

  const columns = useMemo(
    () => [
      {
        label: intl.formatMessage({ id: ETranslations.global_asset }),
        key: 'asset',
        render: (item: ISupplyAsset) => (
          <AssetWithAmountField
            token={item.token}
            amountLabel={{
              text: `${intl.formatMessage({
                id: ETranslations.global_balance,
              })}:`,
            }}
            amount={item.walletBalance.title}
            amountDescription={item.walletBalance.description}
            platformBonusApy={item.platformBonusApy}
          />
        ),
        flex: 1.5,
      },
      {
        label: intl.formatMessage({ id: ETranslations.defi_supply_apy }),
        align: 'flex-end' as const,
        key: 'supplyApy',
        render: (item: ISupplyAsset) => (
          <BorrowAPYField apyDetail={item.apyDetail} />
        ),
        flex: 1,
      },
    ],
    [intl],
  );

  return (
    <YStack testID={BorrowTestIDs.mobileEmptyState}>
      <YStack gap="$2">
        <XStack ai="center" jc="space-between" gap="$3" minHeight="$9">
          <SizableText
            size="$headingMd"
            px="$1"
            flexShrink={1}
            numberOfLines={1}
          >
            {intl.formatMessage({
              id: ETranslations.earns_on_your_holding__title,
            })}
          </SizableText>
          {onRefresh ? (
            <BorrowRefreshButton loading={isRefreshing} onPress={onRefresh} />
          ) : null}
        </XStack>
        <BorrowTableList<ISupplyAsset>
          data={topAssets}
          isLoading={isLoading}
          columns={columns}
          onPressRow={onPressAsset}
          skeletonCount={3}
          emptyContent={intl.formatMessage({
            id: ETranslations.defi_no_assets_to_supply,
          })}
        />
      </YStack>
    </YStack>
  );
}

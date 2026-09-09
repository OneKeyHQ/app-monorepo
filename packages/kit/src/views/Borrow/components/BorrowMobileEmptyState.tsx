import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveItem } from '@onekeyhq/shared/types/staking';

import { BorrowTestIDs } from '../testIDs';

import { pickTopSupplyAssetsByApy } from './borrowEmptyState.utils';
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
};

export function BorrowMobileEmptyState({
  assets,
  isLoading,
  onPressAsset,
}: IBorrowMobileEmptyStateProps) {
  const intl = useIntl();
  const topAssets = useMemo(() => pickTopSupplyAssetsByApy(assets), [assets]);

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
        <SizableText size="$headingMd" px="$1">
          {intl.formatMessage({
            id: ETranslations.earns_on_your_holding__title,
          })}
        </SizableText>
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

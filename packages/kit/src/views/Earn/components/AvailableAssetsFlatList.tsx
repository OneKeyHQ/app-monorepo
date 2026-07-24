import { memo, useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  ActionList,
  Badge,
  Dialog,
  Icon,
  ScrollView,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IActionListItemProps } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  useEarnAtom,
  useEarnLoadingStatesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { useNavigateToEarnAsset } from '../hooks/useNavigateToEarnAsset';
import { EarnTestIDs } from '../testIDs';
import {
  filterAndSortAvailableAssets,
  getAvailableAssetNetworkData,
} from '../utils/availableAssetsUtils';

import { AprText } from './AprText';
import { buildEarnAvailableAssetCategoryTabs } from './earnCategoryTabs';
import { NetworkFilterControl } from './NetworkFilterControl';

import type { IEarnAvailableAssetSortKey } from '../utils/availableAssetsUtils';

const MAX_INLINE_ASSETS = 4;
const AVAILABLE_ASSETS_DIALOG_MAX_HEIGHT = 512;

function AvailableAssetsDialogSortControl({
  categoryType,
  sortKey,
  onSortChange,
}: {
  categoryType: EAvailableAssetsTypeEnum;
  sortKey: IEarnAvailableAssetSortKey;
  onSortChange: (sortKey: IEarnAvailableAssetSortKey) => void;
}) {
  const intl = useIntl();
  const isFixedRate = categoryType === EAvailableAssetsTypeEnum.FixedRate;
  const options = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.defi_yield_high_to_low,
        }),
        triggerLabel: intl.formatMessage({
          id: ETranslations.defi_apr_apy,
        }),
        value: 'yield' as const,
      },
      ...(isFixedRate
        ? [
            {
              label: intl.formatMessage({
                id: ETranslations.defi_liquidity_high_to_low,
              }),
              triggerLabel: intl.formatMessage({
                id: ETranslations.earn_tvl,
              }),
              value: 'liquidity' as const,
            },
          ]
        : []),
    ],
    [intl, isFixedRate],
  );
  const selectedOption =
    options.find((option) => option.value === sortKey) ?? options[0];

  const handlePress = useCallback(() => {
    ActionList.show({
      title: intl.formatMessage({ id: ETranslations.market_sort_by }),
      items: options.map<IActionListItemProps>((option) => ({
        testID: EarnTestIDs.flatAssetDialogSortOption(
          categoryType,
          option.value,
        ),
        label: option.label,
        extra:
          option.value === sortKey ? (
            <Icon name="CheckRadioSolid" size="$5" color="$icon" />
          ) : undefined,
        onPress: () => onSortChange(option.value),
      })),
    });
  }, [categoryType, intl, onSortChange, options, sortKey]);

  return (
    <XStack
      testID={EarnTestIDs.flatAssetDialogSort(categoryType)}
      role="button"
      ai="center"
      gap="$1"
      flexShrink={0}
      cursor="pointer"
      userSelect="none"
      pressStyle={{ opacity: 0.5 }}
      onPress={handlePress}
    >
      <Icon name="FilterSortOutline" size="$3" color="$iconSubdued" />
      <SizableText size="$bodySmMedium" color="$textSubdued" numberOfLines={1}>
        {selectedOption.triggerLabel}
      </SizableText>
      <Icon name="ChevronDownSmallOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}

function AvailableAssetsSectionSkeleton() {
  return (
    <YStack gap="$3">
      <Skeleton width={120} height={28} borderRadius="$2" />
      {Array.from({ length: 3 }).map((_, index) => (
        <XStack key={index} px="$1" py="$2" ai="center" gap="$3">
          <Skeleton width="$8" height="$8" radius="round" />
          <Skeleton width={64} height={24} borderRadius="$2" />
          <YStack flex={1} />
          <Skeleton width={88} height={24} borderRadius="$2" />
        </XStack>
      ))}
    </YStack>
  );
}

function AvailableAssetItem({
  asset,
  categoryType,
  totalLiquidityLabel,
  testID,
  onPress,
}: {
  asset: IEarnAvailableAsset;
  categoryType: EAvailableAssetsTypeEnum;
  totalLiquidityLabel: string;
  testID: string;
  onPress: () => void;
}) {
  const showLiquidity =
    categoryType === EAvailableAssetsTypeEnum.FixedRate &&
    Boolean(asset.liquidity);

  return (
    <ListItem
      testID={testID}
      userSelect="none"
      onPress={onPress}
      renderAvatar={
        <Token size="md" tokenImageUri={asset.logoURI} borderRadius="$full" />
      }
    >
      <ListItem.Text
        flex={1}
        primary={
          <XStack gap="$2" ai="center">
            <SizableText size="$bodyLgMedium">{asset.symbol}</SizableText>
            <XStack gap="$1">
              {asset.badges?.map((badge) => (
                <Badge
                  key={badge.tag}
                  badgeType={badge.badgeType}
                  badgeSize="sm"
                  userSelect="none"
                >
                  <Badge.Text>{badge.tag}</Badge.Text>
                </Badge>
              ))}
            </XStack>
          </XStack>
        }
        secondary={
          showLiquidity ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {`${totalLiquidityLabel} ${asset.liquidity ?? ''}`}
            </SizableText>
          ) : undefined
        }
      />
      <XStack flex={1} ai="center" jc="flex-end">
        <AprText asset={asset} />
      </XStack>
    </ListItem>
  );
}

function AvailableAssetsDialogContent({
  assets,
  categoryType,
  totalLiquidityLabel,
  onAssetPress,
}: {
  assets: IEarnAvailableAsset[];
  categoryType: EAvailableAssetsTypeEnum;
  totalLiquidityLabel: string;
  onAssetPress: (asset: IEarnAvailableAsset) => void;
}) {
  const [selectedNetworkIds, setSelectedNetworkIds] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<IEarnAvailableAssetSortKey>('yield');
  const { availableNetworkIds, networkAssetCounts } = useMemo(
    () => getAvailableAssetNetworkData(assets),
    [assets],
  );
  const visibleAssets = useMemo(
    () =>
      filterAndSortAvailableAssets({
        assets,
        selectedNetworkIds,
        sortKey,
      }),
    [assets, selectedNetworkIds, sortKey],
  );

  return (
    <YStack>
      <XStack px="$5" py="$2" ai="center" jc="space-between" gap="$3">
        <XStack flex={1} minWidth={0}>
          <NetworkFilterControl
            testID={EarnTestIDs.flatAssetDialogNetworkFilter(categoryType)}
            variant="compact"
            availableNetworkIds={availableNetworkIds}
            selectedNetworkIds={selectedNetworkIds}
            networkAssetCounts={networkAssetCounts}
            onSelectionChange={setSelectedNetworkIds}
          />
        </XStack>
        <AvailableAssetsDialogSortControl
          categoryType={categoryType}
          sortKey={sortKey}
          onSortChange={setSortKey}
        />
      </XStack>
      <ScrollView
        maxHeight={AVAILABLE_ASSETS_DIALOG_MAX_HEIGHT}
        nestedScrollEnabled
      >
        <YStack>
          {visibleAssets.map((asset) => (
            <AvailableAssetItem
              key={`${categoryType}-${asset.symbol}`}
              asset={asset}
              categoryType={categoryType}
              totalLiquidityLabel={totalLiquidityLabel}
              testID={EarnTestIDs.flatAssetDialogItem(
                categoryType,
                asset.symbol,
              )}
              onPress={() => onAssetPress(asset)}
            />
          ))}
        </YStack>
      </ScrollView>
    </YStack>
  );
}

function AvailableAssetsFlatListComponent() {
  const intl = useIntl();
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const [loadingStates] = useEarnLoadingStatesAtom();
  const navigateToAsset = useNavigateToEarnAsset();
  const sections = useMemo(
    () => buildEarnAvailableAssetCategoryTabs(intl),
    [intl],
  );
  const totalLiquidityLabel = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.dexmarket_details_liquidity_change_total,
      }),
    [intl],
  );

  const handleAssetPress = useCallback(
    (asset: IEarnAvailableAsset, categoryType: EAvailableAssetsTypeEnum) => {
      void navigateToAsset(asset, categoryType);
    },
    [navigateToAsset],
  );

  const handleOpenSection = useCallback(
    ({
      assets,
      categoryType,
      title,
    }: {
      assets: IEarnAvailableAsset[];
      categoryType: EAvailableAssetsTypeEnum;
      title: string;
    }) => {
      const dialog = Dialog.show({
        title,
        testID: EarnTestIDs.flatAssetCategoryDialog(categoryType),
        showFooter: false,
        estimatedContentHeight: AVAILABLE_ASSETS_DIALOG_MAX_HEIGHT,
        contentContainerProps: {
          px: '$0',
          pb: '$5',
        },
        renderContent: (
          <AvailableAssetsDialogContent
            assets={assets}
            categoryType={categoryType}
            totalLiquidityLabel={totalLiquidityLabel}
            onAssetPress={(asset) => {
              void (async () => {
                await dialog.close();
                await navigateToAsset(asset, categoryType);
              })();
            }}
          />
        ),
      });
    },
    [navigateToAsset, totalLiquidityLabel],
  );

  return (
    <YStack gap="$8">
      {sections.map(({ type, title }) => {
        const assets = availableAssetsByType[type] ?? [];
        const isLoading =
          loadingStates[`availableAssets-${type}`] && assets.length === 0;

        if (isLoading) {
          return (
            <YStack key={type} px="$pagePadding">
              <AvailableAssetsSectionSkeleton />
            </YStack>
          );
        }

        if (assets.length === 0) {
          return null;
        }

        return (
          <YStack key={type} gap="$3">
            <XStack
              testID={EarnTestIDs.flatAssetCategoryEntry(type)}
              role="button"
              minHeight="$12"
              px="$pagePadding"
              py="$1"
              ai="center"
              jc="space-between"
              cursor="pointer"
              userSelect="none"
              pressStyle={{ opacity: 0.5 }}
              onPress={() =>
                handleOpenSection({
                  assets,
                  categoryType: type,
                  title,
                })
              }
            >
              <SizableText size="$headingLg" pointerEvents="none">
                {title}
              </SizableText>
              <Icon
                name="ChevronRightSmallOutline"
                size="$5"
                color="$iconSubdued"
                pointerEvents="none"
              />
            </XStack>
            <YStack>
              {assets.slice(0, MAX_INLINE_ASSETS).map((asset) => (
                <AvailableAssetItem
                  key={`${type}-${asset.symbol}`}
                  asset={asset}
                  categoryType={type}
                  totalLiquidityLabel={totalLiquidityLabel}
                  testID={EarnTestIDs.flatAssetItem(type, asset.symbol)}
                  onPress={() => handleAssetPress(asset, type)}
                />
              ))}
            </YStack>
          </YStack>
        );
      })}
    </YStack>
  );
}

export const AvailableAssetsFlatList = memo(AvailableAssetsFlatListComponent);

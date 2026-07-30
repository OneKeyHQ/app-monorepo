import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Icon,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  useEarnAtom,
  useEarnLoadingStatesAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/earn';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { EarnNavigation } from '../earnUtils';
import { useNavigateToEarnAsset } from '../hooks/useNavigateToEarnAsset';
import { EarnTestIDs } from '../testIDs';

import { AprText } from './AprText';
import { buildEarnHomeFlatSections } from './earnCategoryTabs';

const MAX_INLINE_ASSETS = 4;
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

// 导出供 Tokens 首页 (EarnTokens, OK-58505) 复用同款行渲染
export function AvailableAssetItem({
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
      />
      {/* 固定收益: 右侧 APY/APR 作 title、Liquidity 作 subtitle (OK-58879) */}
      <YStack flex={1} ai="flex-end" jc="center" gap="$0.5">
        <AprText asset={asset} />
        {showLiquidity ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {`${totalLiquidityLabel} ${asset.liquidity ?? ''}`}
          </SizableText>
        ) : null}
      </YStack>
    </ListItem>
  );
}

function AvailableAssetsFlatListComponent() {
  const intl = useIntl();
  const [{ availableAssetsByType = {} }] = useEarnAtom();
  const [loadingStates] = useEarnLoadingStatesAtom();
  const navigateToAsset = useNavigateToEarnAsset();
  const navigation = useAppNavigation();
  const sections = useMemo(() => buildEarnHomeFlatSections(intl), [intl]);
  // Staked 资产并入 Trending tokens 分区展示，不再单独成区 (OK-58506)。
  // 按 symbol 去重：同一 symbol 以 SimpleEarn 列表为准。
  const sectionAssetsByType = useMemo(() => {
    const simpleEarnAssets =
      availableAssetsByType[EAvailableAssetsTypeEnum.SimpleEarn] ?? [];
    const stakingAssets =
      availableAssetsByType[EAvailableAssetsTypeEnum.Staking] ?? [];
    const simpleEarnSymbols = new Set(
      simpleEarnAssets.map((asset) => asset.symbol),
    );
    // 热门代币不含固定收益 (OK-58879)：固定收益资产 (PT 类，symbol 独立)
    // 单独成区/成页，从 Trending 合并结果中剔除
    const fixedRateSymbols = new Set(
      (availableAssetsByType[EAvailableAssetsTypeEnum.FixedRate] ?? []).map(
        (asset) => asset.symbol,
      ),
    );
    const merged: typeof availableAssetsByType = {
      ...availableAssetsByType,
      [EAvailableAssetsTypeEnum.SimpleEarn]: [
        ...simpleEarnAssets,
        ...stakingAssets.filter(
          (asset) => !simpleEarnSymbols.has(asset.symbol),
        ),
      ].filter((asset) => !fixedRateSymbols.has(asset.symbol)),
    };
    return merged;
  }, [availableAssetsByType]);
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
    (categoryType: EAvailableAssetsTypeEnum) => {
      // 分区点击进入独立页面，不再用 Dialog (OK-58508)；
      // 固定收益有单独列表页 (OK-58879)
      if (categoryType === EAvailableAssetsTypeEnum.FixedRate) {
        EarnNavigation.pushToEarnFixedRateTokens(navigation);
        return;
      }
      EarnNavigation.pushToEarnTokens(navigation);
    },
    [navigation],
  );

  return (
    <YStack gap="$8">
      {sections.map(({ type, title }) => {
        const assets = sectionAssetsByType[type] ?? [];
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
              // chevron 紧跟标题文字，不右对齐 (OK-58507)
              gap="$1"
              cursor="pointer"
              userSelect="none"
              pressStyle={{ opacity: 0.5 }}
              onPress={() => handleOpenSection(type)}
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

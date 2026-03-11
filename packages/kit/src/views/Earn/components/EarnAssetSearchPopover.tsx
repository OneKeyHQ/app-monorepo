import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Badge,
  Dialog,
  Empty,
  ListView,
  SearchBar,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import type { IEarnAvailableAsset } from '@onekeyhq/shared/types/earn';
import { EAvailableAssetsTypeEnum } from '@onekeyhq/shared/types/earn';

import { AprText } from './AprText';

type ICategoryKey = EAvailableAssetsTypeEnum;

type IAvailableAssetsByType = Partial<
  Record<EAvailableAssetsTypeEnum, IEarnAvailableAsset[]>
>;

function CategoryTabs({
  selected,
  onSelect,
  tabs,
}: {
  selected: ICategoryKey;
  onSelect: (key: ICategoryKey) => void;
  tabs: Array<{ key: ICategoryKey; label: string }>;
}) {
  return (
    <XStack gap="$1" px="$2">
      {tabs.map((tab) => {
        const isFocused = selected === tab.key;
        return (
          <XStack
            key={tab.key}
            px="$2"
            py="$1.5"
            bg={isFocused ? '$bgActive' : '$bg'}
            borderRadius="$2"
            borderCurve="continuous"
            onPress={() => onSelect(tab.key)}
            cursor="default"
          >
            <SizableText
              size="$bodyMdMedium"
              color={isFocused ? '$text' : '$textSubdued'}
              letterSpacing={-0.15}
            >
              {tab.label}
            </SizableText>
          </XStack>
        );
      })}
    </XStack>
  );
}

function SearchResultItem({
  asset,
  onPress,
}: {
  asset: IEarnAvailableAsset;
  onPress: () => void;
}) {
  return (
    <ListItem userSelect="none" onPress={onPress}>
      <Token size="md" tokenImageUri={asset.logoURI} borderRadius="$full" />
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
      <XStack flexShrink={0}>
        <AprText asset={asset} />
      </XStack>
    </ListItem>
  );
}

function EarnAssetSearchDialogContent({
  availableAssetsByType,
  onAssetSelect,
}: {
  availableAssetsByType: IAvailableAssetsByType;
  onAssetSelect: (
    asset: IEarnAvailableAsset,
    categoryType: EAvailableAssetsTypeEnum,
  ) => void;
}) {
  const intl = useIntl();
  const { height: windowHeight } = useWindowDimensions();
  const [searchText, setSearchText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ICategoryKey>(
    EAvailableAssetsTypeEnum.SimpleEarn,
  );

  const dialogContentHeight = useMemo(() => {
    if (!windowHeight) {
      return 360;
    }
    return Math.min(Math.max(windowHeight - 280, 320), 520);
  }, [windowHeight]);

  const categoryTabs = useMemo(
    () => [
      {
        key: EAvailableAssetsTypeEnum.SimpleEarn as ICategoryKey,
        label: intl.formatMessage({ id: ETranslations.global_earn }),
      },
      {
        key: EAvailableAssetsTypeEnum.FixedRate as ICategoryKey,
        label: intl.formatMessage({ id: ETranslations.earn_fixed_income }),
      },
      {
        key: EAvailableAssetsTypeEnum.Staking as ICategoryKey,
        label: intl.formatMessage({
          id: ETranslations.wallet_defi_position_module_staked,
        }),
      },
    ],
    [intl],
  );

  const filteredAssets = useMemo(() => {
    const source = availableAssetsByType[selectedCategory] || [];
    if (!searchText) return source;
    const query = searchText.toLowerCase();
    return source.filter(
      (a) =>
        a.symbol.toLowerCase().includes(query) ||
        a.name.toLowerCase().includes(query),
    );
  }, [availableAssetsByType, selectedCategory, searchText]);

  const renderItem = useCallback(
    ({ item }: { item: IEarnAvailableAsset }) => (
      <SearchResultItem
        asset={item}
        onPress={() => onAssetSelect(item, selectedCategory)}
      />
    ),
    [onAssetSelect, selectedCategory],
  );

  const keyExtractor = useCallback(
    (item: IEarnAvailableAsset) => item.symbol,
    [],
  );

  const searchBarContainerProps = useMemo(
    () => ({
      w: '100%' as const,
      borderRadius: '$full' as const,
      bg: '$bgStrong' as const,
      borderColor: '$transparent' as const,
      overflow: 'hidden' as const,
    }),
    [],
  );

  const listEmptyComponent = useMemo(
    () => (
      <Empty
        icon="SearchOutline"
        title={intl.formatMessage({
          id: ETranslations.global_search_no_results_title,
        })}
      />
    ),
    [intl],
  );

  return (
    <YStack gap="$2" py="$2" height={dialogContentHeight}>
      <YStack px="$2">
        <SearchBar
          autoFocus
          placeholder={intl.formatMessage({
            id: ETranslations.global_search_asset,
          })}
          onSearchTextChange={setSearchText}
          containerProps={searchBarContainerProps}
        />
      </YStack>
      <CategoryTabs
        selected={selectedCategory}
        onSelect={setSelectedCategory}
        tabs={categoryTabs}
      />
      <ListView
        flex={1}
        data={filteredAssets}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={52}
        ListEmptyComponent={listEmptyComponent}
      />
    </YStack>
  );
}

export function showEarnAssetSearchDialog({
  availableAssetsByType,
  onAssetSelect,
}: {
  availableAssetsByType: IAvailableAssetsByType;
  onAssetSelect: (
    asset: IEarnAvailableAsset,
    categoryType: EAvailableAssetsTypeEnum,
  ) => void;
}) {
  const dialog = Dialog.show({
    title: appLocale.intl.formatMessage({ id: ETranslations.global_earn }),
    showFooter: false,
    contentContainerProps: {
      px: '$0',
      pb: '$0',
    },
    renderContent: (
      <EarnAssetSearchDialogContent
        availableAssetsByType={availableAssetsByType}
        onAssetSelect={(asset, categoryType) => {
          void dialog.close();
          onAssetSelect(asset, categoryType);
        }}
      />
    ),
  });
  return dialog;
}

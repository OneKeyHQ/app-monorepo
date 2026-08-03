import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  IconButton,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
  getSharedButtonStyles,
  useMedia,
} from '@onekeyhq/components';
import { ListLoading } from '@onekeyhq/kit/src/components/Loading';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  useHomeFacts,
  useHomeInteraction,
  useHomeResource,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';

import { CategorySelector } from '../../../Market/MarketHomeV2/components/CategorySelector';
import { useHomeSectionPayload } from '../../model/react/homeStoreHooks';
import { useHomeMarketIntents } from '../../model/react/useHomeMarketIntents';
import { HOME_MARKET_SELECTED_CATEGORY_CONTROL_ID } from '../../model/sections/market/homeMarketControls';
import { RichBlock } from '../RichBlock/RichBlock';
import { RichTable } from '../RichTable';

import { FAVORITES_CATEGORY_ID } from './constants';
import { MarketCategoryTokenList } from './MarketCategoryTokenList';
import {
  getPopularTradingColumns,
  renderPopularTradingCommunityBadge,
  renderPopularTradingStockBadges,
} from './metricColumns';
import { getTokenKey } from './utils';

import type {
  IFavoriteTokenDisplay,
  IHomePopularTradingPayload,
} from './types';
const EMPTY_HOME_MARKET_CATEGORIES: IHomePopularTradingPayload['categories'] =
  [];
const EMPTY_HOME_MARKET_WATCH_LIST_ITEMS: IHomePopularTradingPayload['watchListItems'] =
  [];
const EMPTY_HOME_MARKET_ROWS: IFavoriteTokenDisplay[] = [];

function RecommendCardItem({
  token,
  checked,
  onChange,
}: {
  token: IFavoriteTokenDisplay;
  checked: boolean;
  onChange: (checked: boolean, tokenKey: string) => void;
}) {
  const { sharedFrameStyles } = useMemo(
    () =>
      getSharedButtonStyles({
        disabled: false,
        loading: false,
      }),
    [],
  );

  return (
    <XStack
      userSelect="none"
      flexGrow={1}
      flexBasis={0}
      justifyContent="space-between"
      px="$4"
      py="$2"
      {...sharedFrameStyles}
      bg="$bgSubdued"
      borderRadius="$3"
      borderWidth={1}
      borderColor="$neutral3"
      onPress={() => onChange(!checked, getTokenKey(token))}
      ai="center"
      $sm={{
        px: '$2.5',
        py: '$2.5',
      }}
    >
      <XStack gap="$3" ai="center" flexShrink={1}>
        <Token
          size="md"
          tokenImageUri={token.logoUrl}
          tokenImageUris={token.logoUrls}
          networkId={token.chainId}
          showNetworkIcon
        />
        <YStack
          flexShrink={1}
          minWidth={0}
          {...(platformEnv.isNativeAndroid
            ? {
                width: '$20',
                height: '$9',
                justifyContent: 'center',
              }
            : {})}
        >
          <XStack alignItems="center" gap="$1" minWidth={0}>
            <SizableText
              size="$bodyLgMedium"
              numberOfLines={1}
              flexShrink={1}
              $sm={{
                size: '$bodyMdMedium',
              }}
            >
              {token.symbol}
            </SizableText>
            {renderPopularTradingStockBadges(token)}
            {renderPopularTradingCommunityBadge(token)}
          </XStack>
          <XStack>
            <SizableText
              size="$bodySm"
              color="$textSubdued"
              flexShrink={1}
              numberOfLines={1}
              maxWidth={120}
              $sm={{
                maxWidth: 70,
              }}
            >
              {token.name}
            </SizableText>
          </XStack>
        </YStack>
      </XStack>
      {checked ? (
        <Stack flexShrink={0}>
          <Icon
            name="CheckRadioSolid"
            size="$6"
            color="$iconActive"
            $sm={{ size: '$5' }}
          />
        </Stack>
      ) : (
        <Stack w="$6" h="$6" $sm={{ w: '$5', h: '$5' }} />
      )}
    </XStack>
  );
}

function PopularTrading({ tableLayout }: { tableLayout?: boolean }) {
  const intl = useIntl();
  const { md } = useMedia();
  const shouldUseTableLayout = Boolean(tableLayout && !md);
  const homeFacts = useHomeFacts();
  const homeInteraction = useHomeInteraction();
  const homeMarketResource = useHomeResource('market');
  const homeMarketPayload = useHomeSectionPayload('market');
  const {
    addRecommended,
    openToken,
    removeFavorite,
    selectCategory,
    toggleFavorite,
    viewMore,
  } = useHomeMarketIntents();
  const [selectedTokens, setSelectedTokens] = useState<IFavoriteTokenDisplay[]>(
    [],
  );
  const initializedSelectionKeyRef = useRef<string | undefined>(undefined);
  const shownCategorySelectorOwnerRef = useRef<string | undefined>(undefined);
  const handleRemoveFromWatchlistRef = useRef<
    (record: IFavoriteTokenDisplay) => void
  >(() => {});

  // Always show 4 tokens in empty state
  const displayCount = 4;

  const storeHasDisplayAuthority =
    homeMarketResource.kind === 'ready' || homeMarketResource.kind === 'empty';
  const activeHomeOwnerKey = homeFacts
    ? `${homeFacts.ownerToken.scopeKey}:${homeFacts.ownerToken.sessionId}`
    : undefined;
  const displayHomeCategories =
    homeMarketPayload?.categories ?? EMPTY_HOME_MARKET_CATEGORIES;
  const displayWatchListItems =
    homeMarketPayload?.watchListItems ?? EMPTY_HOME_MARKET_WATCH_LIST_ITEMS;
  const displayHasUserFavorites =
    homeMarketPayload?.favoriteMode === 'favorites';
  const displayTotalFavoritesCount = homeMarketPayload?.totalFavorites ?? 0;
  const selectedCategoryControl =
    homeInteraction.sectionControls.market?.[
      HOME_MARKET_SELECTED_CATEGORY_CONTROL_ID
    ];
  const requestedCategoryId =
    typeof selectedCategoryControl === 'string' && selectedCategoryControl
      ? selectedCategoryControl
      : FAVORITES_CATEGORY_ID;
  const isCategoryTransitionPending = Boolean(
    homeMarketPayload &&
    homeMarketPayload.selectedCategoryId !== requestedCategoryId,
  );
  const displayRows = isCategoryTransitionPending
    ? EMPTY_HOME_MARKET_ROWS
    : (homeMarketPayload?.rows ?? EMPTY_HOME_MARKET_ROWS);
  const displayResolvedCategoryId = displayHomeCategories.some(
    (category) => category.id === requestedCategoryId,
  )
    ? requestedCategoryId
    : (homeMarketPayload?.resolvedCategoryId ?? FAVORITES_CATEGORY_ID);
  const displaySelectedMarketCategoryId =
    displayResolvedCategoryId === FAVORITES_CATEGORY_ID
      ? undefined
      : displayResolvedCategoryId;

  const isTokenInWatchList = useCallback(
    (record: IFavoriteTokenDisplay) => {
      if (record.perpsCoin) {
        return displayWatchListItems.some(
          (item) => item.perpsCoin === record.perpsCoin,
        );
      }

      return displayWatchListItems.some((item) =>
        equalTokenNoCaseSensitive({
          token1: {
            networkId: record.chainId,
            contractAddress: record.contractAddress,
          },
          token2: {
            networkId: item.chainId,
            contractAddress: item.contractAddress,
          },
        }),
      );
    },
    [displayWatchListItems],
  );

  const handleMarketCategoryStarPress = useCallback(
    async (record: IFavoriteTokenDisplay) => {
      const checked = isTokenInWatchList(record);
      try {
        await toggleFavorite({
          checked,
          record,
          watchListItems: displayWatchListItems,
        });
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
    },
    [displayWatchListItems, intl, isTokenInWatchList, toggleFavorite],
  );

  // Columns for table layout (only used when user has favorites)
  const columns = useMemo(() => {
    // Favorites are already in the watchlist, so the star always removes.
    const renderStarButton = (record: IFavoriteTokenDisplay) => (
      <IconButton
        testID={
          shouldUseTableLayout ? 'home-columns-icon-btn' : 'home-icon-btn'
        }
        icon="StarSolid"
        size="small"
        variant="tertiary"
        iconProps={{ color: '$iconActive' }}
        title={intl.formatMessage({
          id: ETranslations.market_remove_from_favorites,
        })}
        m="$0"
        onPress={() => handleRemoveFromWatchlistRef.current(record)}
        {...(shouldUseTableLayout
          ? undefined
          : {
              hoverStyle: { bg: 'transparent' },
              pressStyle: { bg: 'transparent' },
            })}
      />
    );

    return getPopularTradingColumns({
      intl,
      shouldUseTableLayout,
      renderStarButton,
    });
  }, [intl, shouldUseTableLayout]);

  const shouldHideCategorySelector =
    !activeHomeOwnerKey ||
    (shownCategorySelectorOwnerRef.current !== activeHomeOwnerKey &&
      !storeHasDisplayAuthority);

  useEffect(() => {
    if (!shouldHideCategorySelector && activeHomeOwnerKey) {
      shownCategorySelectorOwnerRef.current = activeHomeOwnerKey;
    }
  }, [activeHomeOwnerKey, shouldHideCategorySelector]);

  // Initialize once per authoritative owner/category generation. Subsequent
  // refreshes preserve the user's selection and only discard rows that are no
  // longer part of the current Store payload.
  useEffect(() => {
    if (
      !activeHomeOwnerKey ||
      !storeHasDisplayAuthority ||
      displayHasUserFavorites ||
      displayRows.length === 0
    ) {
      initializedSelectionKeyRef.current = undefined;
      setSelectedTokens([]);
      return;
    }
    const selectionKey = `${activeHomeOwnerKey}:${
      homeMarketPayload?.selectedCategoryId ?? ''
    }:${homeMarketPayload?.favoriteMode ?? ''}`;
    if (initializedSelectionKeyRef.current !== selectionKey) {
      initializedSelectionKeyRef.current = selectionKey;
      setSelectedTokens([...displayRows]);
      return;
    }
    const currentRows = new Map(
      displayRows.map((token) => [getTokenKey(token), token]),
    );
    setSelectedTokens((current) =>
      current.flatMap((token) => {
        const next = currentRows.get(getTokenKey(token));
        return next ? [next] : [];
      }),
    );
  }, [
    activeHomeOwnerKey,
    displayHasUserFavorites,
    displayRows,
    homeMarketPayload?.favoriteMode,
    homeMarketPayload?.selectedCategoryId,
    storeHasDisplayAuthority,
  ]);

  const handleRecommendItemChange = useCallback(
    (checked: boolean, tokenKey: string) => {
      const token = displayRows.find((t) => getTokenKey(t) === tokenKey);
      if (!token) return;

      setSelectedTokens((prev) =>
        checked
          ? [...prev, token]
          : prev.filter((t) => getTokenKey(t) !== tokenKey),
      );
    },
    [displayRows],
  );

  // Handle add tokens button press
  const handleAddTokens = useCallback(async () => {
    if (selectedTokens.length === 0) return;

    try {
      const didAdd = await addRecommended(selectedTokens);
      if (didAdd) {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.market_added_to_watchlist,
          }),
        });
      }
    } catch (_error) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_an_error_occurred,
        }),
      });
    }
  }, [addRecommended, intl, selectedTokens]);

  // Handle remove token from watchlist
  const handleRemoveFromWatchlist = useCallback(
    async (record: IFavoriteTokenDisplay) => {
      try {
        await removeFavorite(record);
      } catch (_error) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.global_an_error_occurred,
          }),
        });
      }
    },
    [intl, removeFavorite],
  );
  handleRemoveFromWatchlistRef.current = handleRemoveFromWatchlist;

  const handleTokenPress = openToken;

  const renderEmptyStateCards = useCallback(() => {
    const isTokenSelected = (token: IFavoriteTokenDisplay) =>
      selectedTokens.some((t) => getTokenKey(t) === getTokenKey(token));

    const renderCardItem = (token: IFavoriteTokenDisplay) => (
      <RecommendCardItem
        key={`${token.chainId}-${token.contractAddress}`}
        token={token}
        checked={isTokenSelected(token)}
        onChange={handleRecommendItemChange}
      />
    );

    if (!shouldUseTableLayout) {
      return (
        <YStack gap="$2.5" width="100%">
          {[0, 1].map((rowIndex) => (
            <XStack gap="$2.5" key={rowIndex}>
              {displayRows
                .slice(rowIndex * 2, rowIndex * 2 + 2)
                .map(renderCardItem)}
            </XStack>
          ))}
        </YStack>
      );
    }

    return (
      <XStack gap="$3" width="100%">
        {displayRows.map(renderCardItem)}
      </XStack>
    );
  }, [
    displayRows,
    selectedTokens,
    handleRecommendItemChange,
    shouldUseTableLayout,
  ]);

  // Navigate to Market favorites tab
  const handleViewMore = useCallback(() => {
    viewMore(displaySelectedMarketCategoryId);
  }, [displaySelectedMarketCategoryId, viewMore]);

  // Render table/list layout for user favorites
  const renderUserFavoritesList = useCallback(() => {
    // Only show "View more" button when there are more than 3 favorites
    const showViewMoreButton = displayTotalFavoritesCount > 3;

    return (
      <YStack>
        <RichTable<IFavoriteTokenDisplay>
          showHeader={shouldUseTableLayout}
          dataSource={displayRows}
          columns={columns}
          keyExtractor={(item) =>
            item.perpsCoin
              ? `perps-${item.perpsCoin}`
              : `${item.chainId}-${item.contractAddress}`
          }
          estimatedItemSize={56}
          rowProps={{
            mx: '$2',
            px: '$3',
          }}
          headerRowProps={{
            px: '$3',
            mx: '$2',
          }}
          onRow={(record) => ({
            onPress: () => handleTokenPress(record),
          })}
        />
        {showViewMoreButton ? (
          <XStack pt="$3" px="$pagePadding" jc="center" ai="center">
            <Button
              testID="home-show-view-more-button-btn"
              variant="secondary"
              onPress={handleViewMore}
              flexGrow={1}
              flexBasis={0}
              childrenAsText={false}
              $md={
                {
                  borderRadius: '$full',
                  hoverStyle: { bg: 'transparent' },
                  pressStyle: { bg: 'transparent' },
                } as any
              }
            >
              <XStack alignItems="center" gap="$2">
                <SizableText size="$bodyMdMedium">
                  {intl.formatMessage({ id: ETranslations.global_view_more })}
                </SizableText>
                <Icon name="ChevronRightSmallOutline" size="$5.5" />
              </XStack>
            </Button>
          </XStack>
        ) : null}
      </YStack>
    );
  }, [
    columns,
    displayRows,
    displayTotalFavoritesCount,
    handleTokenPress,
    handleViewMore,
    intl,
    shouldUseTableLayout,
  ]);

  // Header action button (only show "Add tokens" button in empty state)
  const headerActions = useMemo(() => {
    if (displaySelectedMarketCategoryId) {
      return null;
    }

    // No header action when user has favorites (View more is shown in footer)
    if (displayHasUserFavorites) {
      return null;
    }

    // Show "Add tokens" button in empty state
    return (
      <Button
        testID="home-header-actions-btn"
        size="small"
        variant="tertiary"
        icon="PlusSmallOutline"
        disabled={selectedTokens.length === 0}
        onPress={handleAddTokens}
      >
        {intl.formatMessage(
          { id: ETranslations.market_add_number_tokens },
          { number: selectedTokens.length || 0 },
        )}
      </Button>
    );
  }, [
    displayHasUserFavorites,
    displaySelectedMarketCategoryId,
    selectedTokens.length,
    handleAddTokens,
    intl,
  ]);

  const renderContent = useCallback(() => {
    const listContent = (() => {
      if (displaySelectedMarketCategoryId) {
        return (
          <MarketCategoryTokenList
            tokens={displayRows}
            isLoading={
              isCategoryTransitionPending ||
              (homeMarketResource.kind === 'ready'
                ? homeMarketResource.refresh === 'refreshing'
                : !storeHasDisplayAuthority)
            }
            tableLayout={shouldUseTableLayout}
            isTokenInWatchList={isTokenInWatchList}
            onStarPress={handleMarketCategoryStarPress}
            onTokenPress={handleTokenPress}
            onViewMore={handleViewMore}
          />
        );
      }

      // Keep the initial Fabric subtree stable until Store authority is ready.
      if (!storeHasDisplayAuthority) {
        return (
          <ListLoading
            listCount={displayCount}
            listContainerProps={{ py: '$0' }}
            listHeaderProps={{ px: '$3' }}
          />
        );
      }

      // Empty state: show card layout
      if (!displayHasUserFavorites) {
        if (displayRows.length === 0) {
          return (
            <Stack alignItems="center" justifyContent="center" p="$8">
              <SizableText size="$bodyLg" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.global_no_data,
                })}
              </SizableText>
            </Stack>
          );
        }

        return <YStack px="$pagePadding">{renderEmptyStateCards()}</YStack>;
      }

      // User has favorites: show table/list layout
      return renderUserFavoritesList();
    })();

    return (
      <YStack>
        <YStack px={shouldUseTableLayout ? '$pagePadding' : undefined}>
          {shouldHideCategorySelector ? (
            <Stack h="$10" />
          ) : (
            <CategorySelector
              categories={displayHomeCategories}
              selectedCategoryId={displayResolvedCategoryId}
              onSelectCategory={selectCategory}
              showBorder={false}
              showHorizontalPadding={false}
            />
          )}
        </YStack>
        {listContent}
      </YStack>
    );
  }, [
    displayCount,
    displayHasUserFavorites,
    displayHomeCategories,
    displayResolvedCategoryId,
    displayRows,
    displaySelectedMarketCategoryId,
    handleMarketCategoryStarPress,
    handleTokenPress,
    handleViewMore,
    homeMarketResource,
    intl,
    isCategoryTransitionPending,
    isTokenInWatchList,
    renderEmptyStateCards,
    renderUserFavoritesList,
    shouldHideCategorySelector,
    shouldUseTableLayout,
    selectCategory,
    storeHasDisplayAuthority,
  ]);

  return (
    <RichBlock
      title={intl.formatMessage({ id: ETranslations.global_market })}
      headerActions={headerActions}
      headerContainerProps={{ px: '$pagePadding' }}
      content={renderContent()}
      plainContentContainer
    />
  );
}

export { PopularTrading };

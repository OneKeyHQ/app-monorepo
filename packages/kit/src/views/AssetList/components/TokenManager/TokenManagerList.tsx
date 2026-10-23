import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  NativeList,
  validateSnapshot,
} from '@onekeyfe/react-native-native-list';
import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  Divider,
  Empty,
  SectionList,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
  useTheme,
} from '@onekeyhq/components';
import { LazyTooltip } from '@onekeyhq/components/src/actions/LazyTooltip';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import TokenIconView from '@onekeyhq/kit/src/components/TokenListView/TokenIconView';
import { useTokenListViewContext } from '@onekeyhq/kit/src/components/TokenListView/TokenListViewContext';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  IAggregateToken,
  ICustomTokenItem,
} from '@onekeyhq/shared/types/token';

import { AssetListTestIDs } from '../../testIDs';

import type {
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  NativeListTheme,
  RowActionEvent,
  RowModel,
  VisualOverlay,
} from '@onekeyfe/react-native-native-list';

type ITokenManagerListProps = {
  dataSource:
    | {
        title: string;
        data: ICustomTokenItem[];
      }[]
    | undefined;
  onAddCustomToken: (token?: ICustomTokenItem) => void;
  onHiddenToken: (token: ICustomTokenItem) => Promise<void>;
  isLoadingRemoteData: boolean;
  isLoadingLocalData?: boolean;
  networkId: string;
  isAllNetwork: boolean;
  networkMaps: Record<string, IServerNetwork>;
  checkTokenExistInTokenList: (
    token: ICustomTokenItem,
  ) => ICustomTokenItem | undefined;
  searchValue: string;
  searchResult: ICustomTokenItem[] | null;
  showListHeader?: boolean;
  aggregateTokenConfigMap?: Record<string, IAggregateToken>;
};

const MAX_NATIVE_TEXT_LENGTH = 4096;
const MAX_NATIVE_KEY_LENGTH = 256;

function truncateNativeText(text: unknown): string {
  if (typeof text !== 'string') return '';
  if (text.length <= MAX_NATIVE_TEXT_LENGTH) return text;
  const end = /[\uD800-\uDBFF]/.test(text[MAX_NATIVE_TEXT_LENGTH - 1])
    ? MAX_NATIVE_TEXT_LENGTH - 1
    : MAX_NATIVE_TEXT_LENGTH;
  return text.slice(0, end);
}

function nativeImageUri(uri: unknown): string | undefined {
  return typeof uri === 'string' &&
    uri.trim() &&
    uri.length <= MAX_NATIVE_TEXT_LENGTH
    ? uri
    : undefined;
}

function tokenRowKey(item: ICustomTokenItem, fallbackNetworkId: string) {
  if (!item || typeof item !== 'object') return '';
  const entityKey = item.$key || item.address;
  if (typeof entityKey !== 'string' || !entityKey.trim()) return '';
  const key = JSON.stringify([
    typeof item.networkId === 'string' ? item.networkId : fallbackNetworkId,
    typeof item.accountId === 'string' ? item.accountId : '',
    entityKey,
  ]);
  return key.length <= MAX_NATIVE_KEY_LENGTH ? key : '';
}

function ListHeaderComponent({
  onAddCustomToken,
}: {
  onAddCustomToken: (token?: ICustomTokenItem) => void;
}) {
  const intl = useIntl();

  return (
    <ListItem
      testID={AssetListTestIDs.addCustomTokenNavBtn}
      title={intl.formatMessage({
        id: ETranslations.manage_token_custom_token_title,
      })}
      drillIn
      onPress={onAddCustomToken as any}
    />
  );
}

function ListEmptyComponent({
  onAddCustomToken,
  isLoading,
}: {
  onAddCustomToken: (token?: ICustomTokenItem) => void;
  isLoading: boolean;
}) {
  const intl = useIntl();
  if (isLoading) {
    return null;
  }
  return (
    <Empty
      flex={1}
      illustration="QuestionMark"
      title={intl.formatMessage({
        id: ETranslations.global_no_results,
      })}
      description={intl.formatMessage({
        id: ETranslations.manage_token_empty_msg,
      })}
      button={
        <Button
          testID={AssetListTestIDs.addCustomTokenBtn}
          mt="$6"
          size="medium"
          variant="primary"
          onPress={() => onAddCustomToken()}
        >
          {intl.formatMessage({
            id: ETranslations.manage_token_custom_token_button,
          })}
        </Button>
      }
    />
  );
}

function ListFooterComponent({
  searchValue,
  searchResult,
  onAddCustomToken,
}: {
  searchValue: string;
  searchResult: ICustomTokenItem[] | null;
  onAddCustomToken: (token?: ICustomTokenItem) => void;
}) {
  const intl = useIntl();

  if (
    searchValue.length &&
    Array.isArray(searchResult) &&
    searchResult.length
  ) {
    return (
      <>
        <Divider pt="$5" />
        <YStack p="$5" alignItems="center">
          <SizableText
            textAlign="center"
            size="$bodyMd"
            maxWidth={platformEnv.isNative ? 256 : undefined}
          >
            {intl.formatMessage({
              id: ETranslations.manage_token_empty_msg,
            })}
          </SizableText>
          <Button
            testID="asset-list-intl-btn"
            mt="$6"
            size="medium"
            variant="primary"
            onPress={() => onAddCustomToken()}
          >
            {intl.formatMessage({
              id: ETranslations.manage_token_custom_token_button,
            })}
          </Button>
        </YStack>
      </>
    );
  }

  return null;
}

function SkeletonList() {
  return Array.from({ length: 5 }).map((_, index) => (
    <ListItem key={index}>
      <XStack alignItems="center" gap="$3">
        <Skeleton width="$10" height="$10" radius="round" />
        <YStack gap="$2">
          <Skeleton w={120} h={12} borderRadius="$3" />
          <Skeleton w={80} h={12} borderRadius="$3" />
        </YStack>
      </XStack>
    </ListItem>
  ));
}

function NativeTokenManagerList({
  dataSource,
  onAddCustomToken,
  onHiddenToken,
  isLoadingRemoteData,
  isLoadingLocalData,
  networkId,
  isAllNetwork,
  networkMaps,
  checkTokenExistInTokenList,
  searchValue,
  searchResult,
  showListHeader = true,
}: ITokenManagerListProps & {
  dataSource: NonNullable<ITokenManagerListProps['dataSource']>;
}) {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { gtMd } = useMedia();
  const colors = useTheme();
  const themeVariant = useThemeVariant();
  const {
    allAggregateTokenMap,
    ownedAggregateTokenListMap,
    networksMap: contextNetworksMap,
  } = useTokenListViewContext();
  const pendingActions = useRef(new Set<string>());
  const active = useRef(true);
  const listRef = useRef<NativeListRef>(null);
  const [tooltip, setTooltip] = useState<{
    anchor: NativeListActionAnchor;
    rowKey: string;
  }>();
  const tooltipRef = useRef(tooltip);
  tooltipRef.current = tooltip;

  const closeTooltip = useCallback(() => {
    const current = tooltipRef.current;
    if (current) {
      listRef.current?.setActionAnchorState({
        token: current.anchor.token,
        open: false,
        restoreFocus: true,
      });
      tooltipRef.current = undefined;
      setTooltip(undefined);
    }
  }, []);

  useEffect(() => {
    active.current = true;
    const list = listRef.current;
    return () => {
      active.current = false;
      const current = tooltipRef.current;
      if (current) {
        list?.setActionAnchorState({
          token: current.anchor.token,
          open: false,
        });
      }
    };
  }, []);

  const theme = useMemo<NativeListTheme>(
    () => ({
      background: colors.bgApp.val,
      rowBackground: colors.bgApp.val,
      rowSelectedBackground: colors.bgActive.val,
      rowPressedBackground: colors.bgActive.val,
      rowHoverBackground: !platformEnv.isNative
        ? colors.bgHover.val
        : undefined,
      subduedBackground: colors.bgSubdued.val,
      strongBackground: colors.bgStrong.val,
      primaryText: colors.text.val,
      secondaryText: colors.textSubdued.val,
      disabledText: colors.textDisabled.val,
      icon: colors.icon.val,
      iconSubdued: colors.iconSubdued.val,
      separator: colors.borderSubdued.val,
      accent: platformEnv.isNative
        ? colors.iconActive.val
        : colors.focusRing.val,
      positive: colors.textSuccess.val,
      negative: colors.textCritical.val,
      inverseBackground: colors.bgInverse.val,
      inverseText: colors.textInverse.val,
    }),
    [colors],
  );

  const hasTokenRows = dataSource.some((section) => section.data.length > 0);
  const leadingEmptySection =
    dataSource[0]?.data.length === 0 ? dataSource[0] : undefined;

  const { snapshot, tokensByKey } = useMemo(() => {
    const rows: RowModel[] = [];
    const tokenMap = new Map<string, ICustomTokenItem>();

    if (hasTokenRows) {
      dataSource.forEach((section, sectionIndex) => {
        const sectionKey = `section:${sectionIndex}`;
        if (sectionIndex > 0) {
          rows.push({
            key: `gap:${sectionKey}`,
            type: 'system',
            variant: 'spacer',
            height: 20,
          });
        }
        if (sectionIndex === 0 && leadingEmptySection) return;

        rows.push({
          key: `header:${sectionKey}`,
          type: 'sectionHeader',
          sectionKey,
          title: truncateNativeText(section.title),
          height: 30,
          pressDisabled: true,
          style: {
            container: { contentVerticalAlignment: 'bottom' },
            horizontalPadding: 12,
            verticalPadding: 0,
            title: {
              fontSize: 14,
              lineHeight: 20,
              fontWeight: 'regular',
              color: theme.secondaryText,
              lines: 1,
              truncate: 'tail',
            },
          },
        });

        section.data.forEach((item) => {
          const key = tokenRowKey(item, networkId);
          if (!key) return;
          tokenMap.set(key, item);
          const isAdded = !!checkTokenExistInTokenList(item);
          const disabled = isAdded && networkUtils.isBTCNetwork(item.networkId);
          const ownedTokens =
            ownedAggregateTokenListMap?.[item.$key]?.tokens ?? [];
          const allAggregateTokens =
            allAggregateTokenMap?.[item.$key]?.tokens ?? [];
          const selectedNetworkId =
            ownedTokens.length === 1 &&
            allAggregateTokens.length === 0 &&
            ownedTokens[0]?.networkId
              ? ownedTokens[0].networkId
              : (item.networkId ?? networkId);
          const network =
            contextNetworksMap?.[selectedNetworkId] ??
            networkMaps[selectedNetworkId] ??
            networkUtils.getLocalNetworkInfo(selectedNetworkId);
          const showNetworkIcon = isAllNetwork || item.isAggregateToken;
          const tokenLogo = nativeImageUri(item.logoURI);
          const networkLogo = nativeImageUri(network?.logoURI);
          const networkOverlays: VisualOverlay[] = [];
          if (showNetworkIcon && network?.isCustomNetwork && network.name) {
            networkOverlays.push({
              position: 'bottomRight',
              size: 20,
              offset: 4,
              backgroundColor: theme.rowBackground,
            });
            networkOverlays.push({
              position: 'bottomRight',
              text: truncateNativeText(network.name[0]).toUpperCase(),
              size: 16,
              offset: 2,
              fontWeight: 'semibold',
              backgroundColor: theme.inverseBackground,
              tintColor: theme.inverseText,
            });
          } else if (
            showNetworkIcon &&
            !networkLogo &&
            networkUtils.isAggregateNetwork({ networkId: selectedNetworkId })
          ) {
            networkOverlays.push({
              position: 'bottomRight',
              name: 'AllNetworksSolid',
              size: 20,
              padding: 2,
              offset: 4,
              backgroundColor: theme.rowBackground,
              tintColor: theme.accent,
            });
          } else if (showNetworkIcon) {
            networkOverlays.push({
              position: 'bottomRight',
              image: networkLogo
                ? { uri: networkLogo, width: 16, height: 16 }
                : undefined,
              fallbackIcon: networkLogo
                ? {
                    name: 'GlobusOutline',
                    tintColor: theme.iconSubdued,
                  }
                : undefined,
              size: 20,
              padding: 2,
              offset: 4,
              backgroundColor: theme.rowBackground,
            });
          }
          let badgeText: string | undefined;
          if (item.isAggregateToken) {
            badgeText = intl.formatMessage({
              id: ETranslations.global__multichain,
            });
          } else if (isAllNetwork) {
            badgeText = networkMaps[item.networkId ?? '']?.name ?? '';
          }
          const disabledReason = disabled
            ? intl.formatMessage({
                id: ETranslations.manage_token_native_token_cannot_removed,
              })
            : undefined;
          let imageBackground = colors.gray5.val;
          if (tokenLogo) {
            imageBackground =
              themeVariant === 'dark'
                ? colors.neutral6Dark.val
                : theme.rowBackground;
          }

          rows.push({
            key,
            type: 'identity',
            sectionKey,
            height: 60,
            pressDisabled: true,
            leading: {
              kind: 'token',
              image: tokenLogo
                ? {
                    uri: tokenLogo,
                    width: gtMd ? 32 : 40,
                    height: gtMd ? 32 : 40,
                    loadingStrategy: 'skeleton',
                  }
                : undefined,
              fallbackIcon: {
                name: 'CryptoCoinOutline',
                tintColor: theme.iconSubdued,
                size: gtMd ? 24 : 28,
                backgroundColor: colors.gray5.val,
              },
              borderColor:
                themeVariant === 'dark' ? colors.neutral2Dark.val : undefined,
              backgroundColor: imageBackground,
              overlays: networkOverlays.length ? networkOverlays : undefined,
            },
            title: truncateNativeText(item.symbol),
            subtitle: truncateNativeText(item.name),
            badges:
              badgeText !== undefined
                ? [
                    {
                      key: 'network',
                      text: truncateNativeText(badgeText),
                      tone: 'neutral',
                    },
                  ]
                : undefined,
            trailing: [
              {
                kind: 'icon',
                name: isAdded ? 'MinusCircleOutline' : 'PlusCircleOutline',
                buttonStyle: 'tertiary',
                tintColor: isAdded
                  ? colors.iconCritical.val
                  : theme.iconSubdued,
                disabled,
                actionKey: isAdded ? 'hide' : 'add',
                hoverActionKey:
                  disabled && !platformEnv.isNative
                    ? 'cannot-remove'
                    : undefined,
                testID: AssetListTestIDs.tokenManagerToggleBtn,
                accessibilityLabel:
                  disabledReason ??
                  `${intl.formatMessage({ id: isAdded ? ETranslations.global_remove : ETranslations.global_add })} ${item.symbol}`,
              },
            ],
            style: {
              container: { cornerRadius: 12 },
              horizontalPadding: 12,
              verticalPadding: 8,
              leadingGap: 12,
              lineGap: 0,
              titleBadgeGap: 8,
              trailingGap: 12,
              image: {
                width: gtMd ? 32 : 40,
                height: gtMd ? 32 : 40,
                shape: 'circle',
              },
              title: {
                fontSize: 16,
                lineHeight: 24,
                fontWeight: 'medium',
                color: theme.primaryText,
                lines: 1,
                truncate: 'tail',
              },
              subtitle: {
                fontSize: 14,
                lineHeight: 20,
                color: theme.secondaryText,
                lines: 1,
                truncate: 'tail',
              },
            },
          });
        });
      });
    }

    const nextSnapshot: NativeListSnapshot = {
      schemaVersion: 1,
      generation: 1,
      layout: {
        kind: 'sectioned',
        stickyHeaders: false,
        contentPaddingHorizontal: 8,
      },
      theme,
      rows,
    };
    return {
      snapshot: validateSnapshot(nextSnapshot),
      tokensByKey: tokenMap,
    };
  }, [
    dataSource,
    hasTokenRows,
    leadingEmptySection,
    networkId,
    isAllNetwork,
    networkMaps,
    checkTokenExistInTokenList,
    ownedAggregateTokenListMap,
    allAggregateTokenMap,
    contextNetworksMap,
    theme,
    colors.iconCritical.val,
    colors.neutral6Dark.val,
    colors.neutral2Dark.val,
    colors.gray5.val,
    gtMd,
    intl,
    themeVariant,
  ]);

  useEffect(() => {
    const current = tooltipRef.current;
    if (!current) return;
    const item = tokensByKey.get(current.rowKey);
    if (
      !item ||
      !checkTokenExistInTokenList(item) ||
      !networkUtils.isBTCNetwork(item.networkId)
    ) {
      closeTooltip();
    }
  }, [tokensByKey, checkTokenExistInTokenList, closeTooltip]);

  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (!active.current || !event.rowKey) return;
      const item = tokensByKey.get(event.rowKey);
      if (!item || pendingActions.current.has(event.rowKey)) return;
      const isAdded = !!checkTokenExistInTokenList(item);
      if (event.actionKey === 'cannot-remove') {
        if (
          platformEnv.isNative ||
          !isAdded ||
          !networkUtils.isBTCNetwork(item.networkId) ||
          event.anchor?.source !== 'trailingAccessory' ||
          event.anchor.slot !== 0
        ) {
          return;
        }
        listRef.current?.setActionAnchorState({
          token: event.anchor.token,
          open: true,
        });
        const nextTooltip = { anchor: event.anchor, rowKey: event.rowKey };
        tooltipRef.current = nextTooltip;
        setTooltip(nextTooltip);
        return;
      }
      if (event.actionKey !== (isAdded ? 'hide' : 'add')) return;
      if (isAdded && networkUtils.isBTCNetwork(item.networkId)) return;

      pendingActions.current.add(event.rowKey);
      try {
        defaultLogger.ui.button.click({
          trackId: AssetListTestIDs.tokenManagerToggleBtn,
        });
        const action = isAdded ? onHiddenToken(item) : onAddCustomToken(item);
        void Promise.resolve(action).finally(() => {
          pendingActions.current.delete(event.rowKey ?? '');
        });
      } catch (error) {
        pendingActions.current.delete(event.rowKey);
        throw error;
      }
    },
    [tokensByKey, checkTokenExistInTokenList, onHiddenToken, onAddCustomToken],
  );

  return (
    <>
      <NativeList
        ref={listRef}
        style={{ flex: 1 }}
        snapshot={snapshot}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onRowAction={handleRowAction}
        onActionAnchorInvalidated={(event) => {
          if (tooltipRef.current?.anchor.token === event.token) closeTooltip();
        }}
        listHeader={
          <>
            {showListHeader ? (
              <ListHeaderComponent onAddCustomToken={onAddCustomToken} />
            ) : null}
            {leadingEmptySection ? (
              <>
                <SizableText
                  mt={10}
                  px="$5"
                  size="$bodyMd"
                  color="$textSubdued"
                >
                  {leadingEmptySection.title}
                </SizableText>
                {hasTokenRows ? (
                  <ListEmptyComponent
                    onAddCustomToken={onAddCustomToken}
                    isLoading={isLoadingRemoteData || !!isLoadingLocalData}
                  />
                ) : null}
              </>
            ) : null}
          </>
        }
        listFooter={
          <>
            <ListFooterComponent
              searchValue={searchValue}
              searchResult={searchResult}
              onAddCustomToken={onAddCustomToken}
            />
            <Stack h={bottom || '$3'} />
          </>
        }
        listEmpty={
          <ListEmptyComponent
            onAddCustomToken={onAddCustomToken}
            isLoading={isLoadingRemoteData || !!isLoadingLocalData}
          />
        }
      />
      {!platformEnv.isNative && tooltip ? (
        <Stack
          position="fixed"
          left={tooltip.anchor.windowRect.x}
          top={tooltip.anchor.windowRect.y}
          width={tooltip.anchor.windowRect.width}
          height={tooltip.anchor.windowRect.height}
          pointerEvents="none"
        >
          <LazyTooltip
            open
            onOpenChange={(open) => {
              if (!open) closeTooltip();
            }}
            placement="top"
            offset={12}
            renderTrigger={
              <Stack
                width={tooltip.anchor.windowRect.width}
                height={tooltip.anchor.windowRect.height}
                pointerEvents="none"
              />
            }
            renderContent={intl.formatMessage({
              id: ETranslations.manage_token_native_token_cannot_removed,
            })}
          />
        </Stack>
      ) : null}
    </>
  );
}

function TokenManagerList({
  dataSource,
  onAddCustomToken,
  onHiddenToken,
  isLoadingRemoteData,
  isLoadingLocalData,
  networkId,
  isAllNetwork,
  networkMaps,
  checkTokenExistInTokenList,
  searchValue,
  searchResult,
  showListHeader = true,
}: ITokenManagerListProps) {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();

  const renderItemBadge = useCallback(
    (item: IAccountToken) => {
      if (item.isAggregateToken) {
        return (
          <Badge>
            {intl.formatMessage({ id: ETranslations.global__multichain })}
          </Badge>
        );
      }

      if (isAllNetwork) {
        return <Badge>{networkMaps?.[item.networkId ?? '']?.name ?? ''}</Badge>;
      }

      return null;
    },
    [intl, isAllNetwork, networkMaps],
  );

  if (isLoadingRemoteData || !dataSource) {
    return <SkeletonList />;
  }
  const keys = dataSource.flatMap((section) =>
    section.data.map((item) => tokenRowKey(item, networkId)),
  );
  const hasUnsupportedEmptySection = dataSource.some(
    (section, index) => index > 0 && section.data.length === 0,
  );
  const validKeys = keys.filter(Boolean);
  if (
    !hasUnsupportedEmptySection &&
    validKeys.length === keys.length &&
    new Set(validKeys).size === validKeys.length
  ) {
    return (
      <NativeTokenManagerList
        dataSource={dataSource}
        onAddCustomToken={onAddCustomToken}
        onHiddenToken={onHiddenToken}
        isLoadingRemoteData={isLoadingRemoteData}
        isLoadingLocalData={isLoadingLocalData}
        networkId={networkId}
        isAllNetwork={isAllNetwork}
        networkMaps={networkMaps}
        checkTokenExistInTokenList={checkTokenExistInTokenList}
        searchValue={searchValue}
        searchResult={searchResult}
        showListHeader={showListHeader}
      />
    );
  }
  return (
    <SectionList
      ListHeaderComponent={
        showListHeader ? (
          <ListHeaderComponent onAddCustomToken={onAddCustomToken} />
        ) : null
      }
      sections={dataSource}
      estimatedItemSize={60}
      renderSectionHeader={({ section: { title, data } }) => (
        <>
          <SizableText mt={10} px="$5" size="$bodyMd" color="$textSubdued">
            {title}
          </SizableText>
          {Array.isArray(data) && !data.length ? (
            <ListEmptyComponent
              onAddCustomToken={onAddCustomToken}
              isLoading={isLoadingRemoteData || !!isLoadingLocalData}
            />
          ) : null}
        </>
      )}
      keyExtractor={(item) => (item as ICustomTokenItem).$key}
      renderItem={({ item }: { item: ICustomTokenItem }) => (
        <ListItem>
          <TokenIconView
            $key={item.$key}
            icon={item.logoURI}
            networkId={item.networkId ?? networkId}
            isAllNetworks
            showNetworkIcon={isAllNetwork || item.isAggregateToken}
          />
          <YStack flex={1}>
            <XStack gap="$2" alignItems="center" flexShrink={1}>
              <SizableText
                size="$bodyLgMedium"
                color="$text"
                flexShrink={1}
                numberOfLines={1}
              >
                {item.symbol}
              </SizableText>
              {renderItemBadge(item)}
            </XStack>
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              flexShrink={1}
              numberOfLines={1}
            >
              {item.name}
            </SizableText>
          </YStack>
          <ListItem.IconButton
            testID={AssetListTestIDs.tokenManagerToggleBtn}
            disabled={
              !!(
                checkTokenExistInTokenList(item) &&
                networkUtils.isBTCNetwork(item.networkId)
              )
            }
            title={
              checkTokenExistInTokenList(item) &&
              networkUtils.isBTCNetwork(item.networkId)
                ? intl.formatMessage({
                    id: ETranslations.manage_token_native_token_cannot_removed,
                  })
                : undefined
            }
            icon={
              checkTokenExistInTokenList(item)
                ? 'MinusCircleOutline'
                : 'PlusCircleOutline'
            }
            onPress={() =>
              checkTokenExistInTokenList(item)
                ? onHiddenToken(item)
                : onAddCustomToken(item)
            }
            {...(checkTokenExistInTokenList(item) && {
              iconProps: {
                color: '$iconCritical',
              },
            })}
          />
        </ListItem>
      )}
      ListFooterComponent={
        <>
          <ListFooterComponent
            searchValue={searchValue}
            searchResult={searchResult}
            onAddCustomToken={onAddCustomToken}
          />
          <Stack h={bottom || '$3'} />
        </>
      }
      ListEmptyComponent={
        <ListEmptyComponent
          onAddCustomToken={onAddCustomToken}
          isLoading={isLoadingRemoteData || !!isLoadingLocalData}
        />
      }
      keyboardDismissMode="on-drag"
    />
  );
}

export { TokenManagerList };

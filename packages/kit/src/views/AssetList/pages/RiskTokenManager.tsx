import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { useRoute } from '@react-navigation/core';
import { debounce, groupBy, keyBy, mapValues } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  LazyTooltip,
  Page,
  Stack,
  Toast,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import { SEARCH_DEBOUNCE_INTERVAL } from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalAssetDetailRoutes,
  type EModalAssetListRoutes,
  type IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IAccountToken,
  ICloudSyncCustomToken,
} from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { EmptySearch } from '../../../components/Empty';
import { useTokenListViewContext } from '../../../components/TokenListView/TokenListViewContext';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import { withTokenListProvider } from '../../../states/jotai/contexts/tokenList';
import { AssetListTestIDs } from '../testIDs';

import type {
  ActionAnchorInvalidatedEvent,
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  NativeListTheme,
  RowActionEvent,
  RowModel,
  VisualOverlay,
} from '@onekeyfe/react-native-native-list';
import type { RouteProp } from '@react-navigation/core';
import type { NativeSyntheticEvent, ViewInstance } from 'react-native';
import type { SearchBarTextEventData } from 'react-native-screens';

type IRiskToken = IAccountToken & { isBlocked: boolean };
type IRiskSection = {
  key: 'visible' | 'collapsed';
  title: string;
  data: IRiskToken[];
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

function riskTokenRowKey(token: IRiskToken, fallbackNetworkId: string) {
  if (!token || typeof token !== 'object') return '';
  const networkId =
    typeof token.networkId === 'string' ? token.networkId : fallbackNetworkId;
  const accountId = typeof token.accountId === 'string' ? token.accountId : '';
  for (const entityKey of [token.$key, token.address]) {
    if (typeof entityKey === 'string' && entityKey.trim()) {
      const key = JSON.stringify([networkId, accountId, entityKey]);
      if (key.length <= MAX_NATIVE_KEY_LENGTH) return key;
    }
  }
  return '';
}

export function RiskNativeList({
  sections,
  networkId,
  isAllNetworks,
  isEditing,
  unblockedTokensMap,
  blockedTokensMap,
  customTokensMap,
  onPressToken,
  onToggleToken,
}: {
  sections: IRiskSection[];
  networkId: string;
  isAllNetworks: boolean;
  isEditing: boolean;
  unblockedTokensMap: Record<string, Record<string, boolean>>;
  blockedTokensMap: Record<string, Record<string, boolean>>;
  customTokensMap: Record<string, Record<string, ICloudSyncCustomToken>>;
  onPressToken: (token: IRiskToken) => void;
  onToggleToken: (token: IRiskToken) => void;
}) {
  const colors = useTheme();
  const { gtMd } = useMedia();
  const themeVariant = useThemeVariant();
  const intl = useIntl();
  const { networksMap, networkMetadataProvided } = useTokenListViewContext();
  const listRef = useRef<NativeListRef>(null);
  const containerRef = useRef<ViewInstance>(null);
  const activeTooltipToken = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(true);
  const [nativeTokenTooltip, setNativeTokenTooltip] = useState<{
    anchor: NativeListActionAnchor;
    left: number;
    top: number;
  }>();
  const [fetchedNetworks, setFetchedNetworks] = useState<
    Record<string, IServerNetwork>
  >({});
  const networkIds = useMemo(
    () =>
      Array.from(
        new Set(
          sections.flatMap((section) =>
            section.data.map((token) => token?.networkId ?? networkId),
          ),
        ),
      ).filter((id): id is string => typeof id === 'string' && !!id),
    [sections, networkId],
  );
  useEffect(() => {
    if (!isAllNetworks || networkMetadataProvided) return undefined;
    let active = true;
    void Promise.all(
      networkIds
        .filter((id) => !networksMap?.[id])
        .map(async (id) => {
          try {
            const network = await backgroundApiProxy.serviceNetwork.getNetwork({
              networkId: id,
            });
            return network?.id === id ? network : undefined;
          } catch {
            return undefined;
          }
        }),
    ).then((networks) => {
      if (!active) return;
      setFetchedNetworks(
        Object.fromEntries(
          networks
            .filter((network): network is IServerNetwork => !!network)
            .map((network) => [network.id, network]),
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [isAllNetworks, networkMetadataProvided, networkIds, networksMap]);
  const theme = useMemo<NativeListTheme>(
    () => ({
      background: colors.bgApp.val,
      rowBackground: colors.bgApp.val,
      rowSelectedBackground: colors.bgActive.val,
      rowPressedBackground: colors.bgActive.val,
      rowHoverBackground: platformEnv.isNative ? undefined : colors.bgHover.val,
      subduedBackground: colors.bgSubdued.val,
      strongBackground: colors.bgStrong.val,
      primaryText: colors.text.val,
      secondaryText: colors.textSubdued.val,
      icon: colors.icon.val,
      iconSubdued: colors.iconSubdued.val,
      separator: colors.borderSubdued.val,
      accent: platformEnv.isNative
        ? colors.iconActive.val
        : colors.focusRing.val,
      positive: colors.textSuccess.val,
      negative: colors.textCritical.val,
    }),
    [colors],
  );
  const { snapshot, tokensByKey } = useMemo(() => {
    const rows: RowModel[] = [];
    const tokenMap = new Map<string, IRiskToken>();
    sections.forEach((section, sectionIndex) => {
      const sectionKey = `risk:${section.key}`;
      if (sectionIndex > 0) {
        rows.push({
          key: `gap:${sectionKey}`,
          type: 'system',
          variant: 'spacer',
          height: 20,
        });
      }
      rows.push({
        key: `header:${sectionKey}`,
        type: 'sectionHeader',
        sectionKey,
        title: truncateNativeText(section.title),
        height: 36,
        pressDisabled: true,
        style: {
          horizontalPadding: 12,
          verticalPadding: 0,
          title: {
            fontSize: 14,
            lineHeight: 20,
            fontWeight: 'semibold',
            color: theme.secondaryText,
            lines: 1,
            truncate: 'tail',
          },
        },
      });
      section.data.forEach((token) => {
        const key = riskTokenRowKey(token, networkId);
        if (!key || tokenMap.has(key)) return;
        tokenMap.set(key, token);
        const tokenNetworkId =
          typeof token.networkId === 'string' ? token.networkId : networkId;
        const network =
          networksMap?.[tokenNetworkId] ??
          fetchedNetworks[tokenNetworkId] ??
          networkUtils.getLocalNetworkInfo(tokenNetworkId);
        const tokenLogo = nativeImageUri(token.logoURI);
        const networkLogo = nativeImageUri(network?.logoURI);
        const showNetworkIcon = isAllNetworks;
        let tokenBackground = colors.gray5.val;
        if (tokenLogo) {
          tokenBackground =
            themeVariant === 'light'
              ? colors.bgApp.val
              : colors.neutral6Dark.val;
        }
        const networkOverlays: VisualOverlay[] = [];
        if (
          showNetworkIcon &&
          network?.isCustomNetwork &&
          typeof network.name === 'string' &&
          network.name
        ) {
          networkOverlays.push({
            position: 'bottomRight',
            size: 20,
            offset: 4,
            backgroundColor: colors.bgApp.val,
          });
          networkOverlays.push({
            position: 'bottomRight',
            size: 16,
            offset: 2,
            text: Array.from(network.name)[0]?.toUpperCase(),
            tintColor: colors.textInverse.val,
            backgroundColor: colors.bgInverse.val,
            fontWeight: 'semibold',
          });
        } else if (showNetworkIcon && networkLogo) {
          networkOverlays.push({
            position: 'bottomRight',
            size: 20,
            padding: 2,
            offset: 4,
            backgroundColor: colors.bgApp.val,
            image: { uri: networkLogo, width: 16, height: 16 },
            fallbackIcon: {
              name: 'GlobusOutline',
              tintColor: colors.iconSubdued.val,
            },
          });
        } else if (
          showNetworkIcon &&
          !networkLogo &&
          networkUtils.isAggregateNetwork({ networkId: tokenNetworkId })
        ) {
          networkOverlays.push({
            position: 'bottomRight',
            size: 20,
            padding: 2,
            offset: 4,
            backgroundColor: colors.bgApp.val,
            name: 'AllNetworksSolid',
            tintColor: colors.iconActive.val,
          });
        }
        const actionLabel = intl.formatMessage({
          id: token.isBlocked
            ? ETranslations.wallet_risk_assets_show_on_home
            : ETranslations.wallet_risk_assets_hide_on_home,
        });
        rows.push({
          key,
          type: 'identity',
          sectionKey,
          testID: AssetListTestIDs.riskTokenListItem,
          height: gtMd ? 48 : 56,
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
            overlays: networkOverlays.length ? networkOverlays : undefined,
            fallbackIcon: {
              name: 'CryptoCoinOutline',
              tintColor: theme.iconSubdued,
              size: gtMd ? 24 : 28,
              backgroundColor: colors.gray5.val,
            },
            backgroundColor: tokenBackground,
            borderColor:
              themeVariant === 'dark' ? colors.neutral2Dark.val : undefined,
          },
          title: truncateNativeText(token.symbol),
          titleIcon:
            token.isNative && !isAllNetworks
              ? {
                  name: 'GasSolid',
                  tintColor: theme.iconSubdued,
                  ...(!platformEnv.isNative
                    ? { hoverActionKey: 'native-token-info' }
                    : undefined),
                }
              : undefined,
          trailing: isEditing
            ? [
                {
                  kind: 'button',
                  label: truncateNativeText(actionLabel),
                  actionKey: token.isBlocked ? 'show' : 'hide',
                  testID: AssetListTestIDs.riskTokenToggleBtn,
                  accessibilityLabel: truncateNativeText(actionLabel),
                  textColor: colors.text.val,
                  backgroundColor: colors.bgStrong.val,
                  pressedBackgroundColor: colors.bgStrongActive.val,
                  hoverBackgroundColor: colors.bgStrongHover.val,
                  focusRingColor: colors.focusRing.val,
                },
              ]
            : undefined,
          style: {
            container: { cornerRadius: 12 },
            horizontalPadding: 12,
            verticalPadding: 8,
            leadingGap: 12,
            leadingContentMaxWidthRatio: 0.6,
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
          },
        });
      });
    });
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
    return { snapshot: nextSnapshot, tokensByKey: tokenMap };
  }, [
    sections,
    networkId,
    networksMap,
    fetchedNetworks,
    isAllNetworks,
    isEditing,
    intl,
    theme,
    colors,
    themeVariant,
    gtMd,
  ]);

  const closeNativeTokenTooltip = useCallback(() => {
    const token = activeTooltipToken.current;
    activeTooltipToken.current = undefined;
    if (token) listRef.current?.setActionAnchorState({ token, open: false });
    setNativeTokenTooltip(undefined);
  }, []);
  const showNativeTokenTooltip = useCallback(
    (event: RowActionEvent) => {
      const anchor = event.anchor;
      if (!anchor) return;
      closeNativeTokenTooltip();
      activeTooltipToken.current = anchor.token;
      listRef.current?.setActionAnchorState({
        token: anchor.token,
        open: true,
      });
      containerRef.current?.measureInWindow((x, y) => {
        if (
          !isMountedRef.current ||
          activeTooltipToken.current !== anchor.token
        )
          return;
        setNativeTokenTooltip({
          anchor,
          left: anchor.windowRect.x - x,
          top: anchor.windowRect.y - y,
        });
      });
    },
    [closeNativeTokenTooltip],
  );
  const onActionAnchorInvalidated = useCallback(
    (event: ActionAnchorInvalidatedEvent) => {
      if (activeTooltipToken.current === event.token) closeNativeTokenTooltip();
    },
    [closeNativeTokenTooltip],
  );
  useEffect(() => {
    closeNativeTokenTooltip();
  }, [closeNativeTokenTooltip, snapshot]);

  const currentActions = useRef({
    tokensByKey,
    isEditing,
    unblockedTokensMap,
    blockedTokensMap,
    customTokensMap,
    onPressToken,
    onToggleToken,
  });
  currentActions.current = {
    tokensByKey,
    isEditing,
    unblockedTokensMap,
    blockedTokensMap,
    customTokensMap,
    onPressToken,
    onToggleToken,
  };
  useEffect(() => {
    isMountedRef.current = true;
    const listHandle = listRef.current;
    return () => {
      isMountedRef.current = false;
      const token = activeTooltipToken.current;
      activeTooltipToken.current = undefined;
      if (token) listHandle?.setActionAnchorState({ token, open: false });
    };
  }, []);

  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      if (!isMountedRef.current) return;
      const current = currentActions.current;
      const token = event.rowKey
        ? current.tokensByKey.get(event.rowKey)
        : undefined;
      if (!token) return;
      if (event.actionKey === 'native-token-info') {
        if (
          !platformEnv.isNative &&
          event.anchor?.source === 'leadingAction' &&
          token.isNative &&
          !isAllNetworks
        )
          showNativeTokenTooltip(event);
        return;
      }
      if (event.actionKey === 'press') {
        current.onPressToken(token);
        return;
      }
      if (!current.isEditing) return;
      const tokenNetworkId = token.networkId ?? networkId;
      const currentUnblocked =
        (Boolean(current.unblockedTokensMap[tokenNetworkId]?.[token.address]) ||
          Boolean(current.customTokensMap[tokenNetworkId]?.[token.address])) &&
        !current.blockedTokensMap[tokenNetworkId]?.[token.address];
      if (
        (event.actionKey === 'show' && currentUnblocked) ||
        (event.actionKey === 'hide' && !currentUnblocked)
      )
        return;
      if (event.actionKey === 'show' || event.actionKey === 'hide') {
        defaultLogger.ui.button.click({
          trackId: AssetListTestIDs.riskTokenToggleBtn,
        });
        current.onToggleToken({ ...token, isBlocked: !currentUnblocked });
      }
    },
    [networkId, isAllNetworks, showNativeTokenTooltip],
  );
  return (
    <Stack ref={containerRef} flex={1} minHeight={0} position="relative">
      <NativeList
        ref={listRef}
        style={{ flex: 1 }}
        snapshot={snapshot}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onRowAction={handleRowAction}
        onActionAnchorInvalidated={onActionAnchorInvalidated}
        listEmpty={<EmptySearch />}
      />
      {nativeTokenTooltip ? (
        <Stack
          position="absolute"
          left={nativeTokenTooltip.left}
          top={nativeTokenTooltip.top}
          width={nativeTokenTooltip.anchor.windowRect.width}
          height={nativeTokenTooltip.anchor.windowRect.height}
          pointerEvents="box-none"
        >
          <LazyTooltip
            open
            triggerAsChild
            placement="bottom"
            offset={6}
            onOpenChange={(open) => {
              if (!open) closeNativeTokenTooltip();
            }}
            renderTrigger={
              <Stack
                width={nativeTokenTooltip.anchor.windowRect.width}
                height={nativeTokenTooltip.anchor.windowRect.height}
                pointerEvents="none"
              />
            }
            renderContent={intl.formatMessage({
              id: ETranslations.native_token_tooltip,
            })}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

function RiskTokenManager() {
  const intl = useIntl();

  const navigation = useAppNavigation();

  const route =
    useRoute<
      RouteProp<
        IModalAssetListParamList,
        EModalAssetListRoutes.RiskTokenManager
      >
    >();

  const {
    tokenList,
    isAllNetworks,
    networkId,
    walletId,
    indexedAccountId,
    accountId,
    deriveType,
    deriveInfo,
    accountAddress,
  } = route.params;

  const { tokens, map: tokenMap } = tokenList;

  const originalUnblockedTokens = useRef('');
  const originalBlockedTokens = useRef('');

  const [unblockedTokensMap, setUnblockedTokensMap] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const [blockedTokensMap, setBlockedTokensMap] = useState<
    Record<string, Record<string, boolean>>
  >({});

  const [customTokensMap, setCustomTokensMap] = useState<
    Record<string, Record<string, ICloudSyncCustomToken>>
  >({});

  const [isEditing, setIsEditing] = useState(false);
  const [searchKey, setSearchKey] = useState('');

  const headerRight = useCallback(() => {
    return (
      <Button
        testID={AssetListTestIDs.riskTokenEditBtn}
        size="sm"
        variant="tertiary"
        onPress={() => {
          setIsEditing((prev) => !prev);
        }}
      >
        {intl.formatMessage({
          id: isEditing ? ETranslations.global_done : ETranslations.global_edit,
        })}
      </Button>
    );
  }, [intl, isEditing]);

  const { result: sectionListData } = usePromiseResult(
    async () => {
      if (!tokens) {
        return [];
      }

      const blockedTokens = [];
      const unblockedTokens = [];

      for (const token of tokens) {
        const tokenNetworkId = token.networkId ?? networkId;

        if (
          (unblockedTokensMap?.[tokenNetworkId]?.[token.address] ||
            !!customTokensMap?.[tokenNetworkId]?.[token.address]) &&
          !blockedTokensMap?.[tokenNetworkId]?.[token.address]
        ) {
          unblockedTokens.push({
            ...token,
            isBlocked: false,
          });
        } else {
          blockedTokens.push({
            ...token,
            isBlocked: true,
          });
        }
      }

      if (unblockedTokens.length === 0) {
        return [
          {
            key: 'collapsed' as const,
            title: intl.formatMessage({
              id: ETranslations.wallet_collapsed_risk_assets,
            }),
            data: blockedTokens,
          },
        ] satisfies IRiskSection[];
      }

      return [
        {
          key: 'visible' as const,
          title: intl.formatMessage({
            id: ETranslations.wallet_risk_assets_always_visible_on_home,
          }),
          data: unblockedTokens,
        },
        {
          key: 'collapsed' as const,
          title: intl.formatMessage({
            id: ETranslations.wallet_collapsed_risk_assets,
          }),
          data: blockedTokens,
        },
      ] satisfies IRiskSection[];
    },
    [
      intl,
      tokens,
      networkId,
      unblockedTokensMap,
      blockedTokensMap,
      customTokensMap,
    ],
    {
      initResult: [],
    },
  );

  const filteredSectionListData = useMemo(() => {
    if (!searchKey.trim()) {
      return sectionListData;
    }

    const result = sectionListData?.map((section) => {
      return {
        ...section,
        data: section.data.filter((token) => {
          return (
            token.symbol?.toLowerCase().includes(searchKey.toLowerCase()) ||
            token.name?.toLowerCase().includes(searchKey.toLowerCase()) ||
            token.address?.toLowerCase().includes(searchKey.toLowerCase())
          );
        }),
      };
    });

    if (result.every((section) => section.data.length === 0)) {
      return [];
    }

    return result;
  }, [sectionListData, searchKey]);

  const handleOnClose = useCallback(async () => {
    await backgroundApiProxy.serviceToken.updateRiskTokensState({
      unblockedTokens: unblockedTokensMap,
      blockedTokens: blockedTokensMap,
    });

    await backgroundApiProxy.serviceToken.clearRiskTokensManagementCache();

    const currentUnblockedTokens = JSON.stringify(unblockedTokensMap);
    const currentBlockedTokens = JSON.stringify(blockedTokensMap);
    if (
      currentUnblockedTokens !== originalUnblockedTokens.current ||
      currentBlockedTokens !== originalBlockedTokens.current
    ) {
      await timerUtils.wait(1000);
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
    }
  }, [unblockedTokensMap, blockedTokensMap]);

  useEffect(() => {
    const fetchRiskTokens = async () => {
      const [u, b, c] = await Promise.all([
        backgroundApiProxy.serviceToken.getUnblockedTokensMap({
          networkId,
        }),
        backgroundApiProxy.serviceToken.getBlockedTokensMap({
          networkId,
        }),
        backgroundApiProxy.serviceCustomToken.getAllCustomTokens(),
      ]);
      setUnblockedTokensMap(u);
      setBlockedTokensMap(b);

      const cMap = mapValues(groupBy(c, 'networkId'), (tokenArray) =>
        keyBy(tokenArray, 'address'),
      );

      setCustomTokensMap(cMap);

      originalUnblockedTokens.current = JSON.stringify(u);
      originalBlockedTokens.current = JSON.stringify(b);
    };

    void fetchRiskTokens();
  }, [networkId]);

  const handleToggleBlockedToken = useCallback(
    (token: IAccountToken & { isBlocked: boolean }) => {
      const tokenNetworkId = token.networkId ?? networkId;
      const tokenAddress = token.address;

      Toast.success({
        title: intl.formatMessage(
          {
            id: token.isBlocked
              ? ETranslations.wallet_risk_assets_hide_on_home_feedback_shown
              : ETranslations.wallet_risk_assets_hide_on_home_feedback_hidden,
          },
          {
            tokenSymbol: token.symbol,
          },
        ),
      });

      setUnblockedTokensMap((prev) => ({
        ...prev,
        [tokenNetworkId]: {
          ...prev[tokenNetworkId],
          [tokenAddress]: !!token.isBlocked,
        },
      }));
      setBlockedTokensMap((prev) => ({
        ...prev,
        [tokenNetworkId]: {
          ...prev[tokenNetworkId],
          [tokenAddress]: !token.isBlocked,
        },
      }));
    },
    [networkId, intl],
  );

  const handleOnPressToken = useCallback(
    (token: IAccountToken & { isBlocked: boolean }) => {
      navigation.push(EModalAssetDetailRoutes.TokenDetails, {
        accountId: token.accountId ?? accountId,
        networkId: token.networkId ?? networkId,
        walletId,
        indexedAccountId,
        tokenInfo: token,
        isBlocked: token.isBlocked,
        deriveInfo,
        deriveType,
        isAllNetworks,
        tokenMap,
        accountAddress,
      });
    },
    [
      navigation,
      accountId,
      networkId,
      walletId,
      indexedAccountId,
      deriveInfo,
      deriveType,
      isAllNetworks,
      tokenMap,
      accountAddress,
    ],
  );

  return (
    <Page onClose={handleOnClose}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_risk_assets,
        })}
        headerRight={headerRight}
        headerSearchBarOptions={{
          onChangeText: debounce(
            (e: NativeSyntheticEvent<SearchBarTextEventData>) =>
              setSearchKey(e.nativeEvent.text),
            SEARCH_DEBOUNCE_INTERVAL,
          ),
          placeholder: intl.formatMessage({
            id: ETranslations.global_search,
          }),
        }}
      />
      <Page.Body>
        <Alert
          type="danger"
          icon="ErrorOutline"
          title={intl.formatMessage({
            id: ETranslations.wallet_risk_assets_description,
          })}
          fullBleed
        />
        <RiskNativeList
          sections={filteredSectionListData}
          networkId={networkId}
          isAllNetworks={!!isAllNetworks}
          isEditing={isEditing}
          unblockedTokensMap={unblockedTokensMap}
          blockedTokensMap={blockedTokensMap}
          customTokensMap={customTokensMap}
          onPressToken={handleOnPressToken}
          onToggleToken={handleToggleBlockedToken}
        />
      </Page.Body>
    </Page>
  );
}

const RiskTokenManagerWithProvider = memo(
  withTokenListProvider(RiskTokenManager),
);
RiskTokenManagerWithProvider.displayName = 'RiskTokenManagerWithProvider';

export default RiskTokenManagerWithProvider;

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  NativeList,
  validateSnapshot,
} from '@onekeyfe/react-native-native-list';
import { useRoute } from '@react-navigation/core';
import { debounce, isString } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  LazyTooltip,
  Page,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useMedia,
  useTheme,
} from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ENABLE_SEARCH_TOKEN_LIST_MIN_LENGTH,
  SEARCH_DEBOUNCE_INTERVAL,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import { isTokenSelectorDappToken } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import {
  checkIsOnlyOneTokenHasBalance,
  flattenAggregateTokensMap,
  getFilteredTokenBySearchKey,
  getTokenPriceChangeStyle,
  sortTokensByFiatValue,
  sortTokensByName,
  sortTokensByPrice,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  displayFiatValueOrUnavailable,
  displayOrUnavailable,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';
import { ETokenListSortType } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { EmptySearch, EmptyToken } from '../../../components/Empty';
import { perfTokenListView } from '../../../components/TokenListView/perfTokenListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useThemeVariant } from '../../../hooks/useThemeVariant';
import {
  useSearchKeyAtom,
  useSearchTokenListAtom,
  useTokenListActions,
  useTokenListSortAtom,
  withTokenListProvider,
} from '../../../states/jotai/contexts/tokenList';
import { convertFiat } from '../../../utils/fiatConvert';

import type {
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  NativeListTheme,
  RowActionEvent,
  RowModel,
  ValueTextSegment,
  VisualOverlay,
} from '@onekeyfe/react-native-native-list';
import type { RouteProp } from '@react-navigation/core';
import type {
  NativeSyntheticEvent,
  TextInputFocusEventData,
  View,
} from 'react-native';

type ITokenListParams =
  IModalAssetListParamList[EModalAssetListRoutes.TokenList];

function formatNativeAmount(
  value: string,
  formatter: 'balance' | 'price' | 'priceChange' | 'value',
  options?: { currency?: string; showPlusMinusSigns?: boolean },
): { text: string; segments?: readonly ValueTextSegment[] } {
  if (value === '-') return { text: '-' };
  const rendered = numberFormatAsRenderText(value, {
    formatter,
    formatterOptions: options,
  });
  if (typeof rendered === 'string') return { text: rendered };
  const segments = rendered.map<ValueTextSegment>((part) =>
    typeof part === 'string'
      ? { text: part }
      : {
          text: String(part.value),
          ...(part.type === 'sub' ? { style: 'subscript' as const } : {}),
        },
  );
  return { text: segments.map((part) => part.text).join(''), segments };
}

function imageUri(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= 4096
    ? value
    : undefined;
}

function TokenListContent({ params }: { params: ITokenListParams }) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const colors = useTheme();
  const { gtMd } = useMedia();
  const themeVariant = useThemeVariant();
  const [searchKey] = useSearchKeyAtom();
  const [searchTokenList] = useSearchTokenListAtom();
  const [{ sortType, sortDirection }] = useTokenListSortAtom();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const listRef = useRef<NativeListRef>(null);
  const containerRef = useRef<View>(null);
  const activeTooltipToken = useRef<string | undefined>(undefined);
  const [gasTooltip, setGasTooltip] = useState<{
    anchor: NativeListActionAnchor;
    left: number;
    top: number;
    content: string;
  }>();
  const [fetchedNetworks, setFetchedNetworks] = useState<
    Record<string, IServerNetwork>
  >({});

  const {
    accountId,
    networkId,
    walletId,
    indexedAccountId,
    tokenList,
    title,
    helpText,
    onPressToken,
    isBlocked,
    deriveInfo,
    deriveType,
    isAllNetworks,
    hideValue,
    aggregateTokensListMap,
    aggregateTokensMap,
    accountAddress,
    allAggregateTokenMap,
    searchKeyLengthThreshold,
  } = params;
  const { tokens, map: tokenMap, keys } = tokenList;

  const hostAggregateTokenFiatMap = useMemo(
    () => flattenAggregateTokensMap(aggregateTokensMap ?? {}),
    [aggregateTokensMap],
  );

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

  const visibleTokens = useMemo(() => {
    let result = getFilteredTokenBySearchKey({
      tokens,
      searchKey,
      searchTokenList: searchTokenList.tokens,
      aggregateTokenListMap: allAggregateTokenMap,
      searchKeyLengthThreshold,
    });
    const map = { ...tokenMap, ...hostAggregateTokenFiatMap };
    if (sortType === ETokenListSortType.Price) {
      result = sortTokensByPrice({ tokens: result, sortDirection, map });
    } else if (sortType === ETokenListSortType.Value) {
      result = sortTokensByFiatValue({ tokens: result, sortDirection, map });
    } else if (sortType === ETokenListSortType.Name) {
      result = sortTokensByName({ tokens: result, sortDirection });
    }
    return result;
  }, [
    tokens,
    searchKey,
    searchTokenList.tokens,
    allAggregateTokenMap,
    searchKeyLengthThreshold,
    tokenMap,
    hostAggregateTokenFiatMap,
    sortType,
    sortDirection,
  ]);

  const visibleNetworkIds = useMemo(
    () =>
      Array.from(
        new Set(
          visibleTokens.flatMap((token) => [
            token.networkId,
            ...(aggregateTokensListMap?.[token.$key]?.tokens ?? []).map(
              (member) => member.networkId,
            ),
          ]),
        ),
      ).filter((id): id is string => typeof id === 'string' && !!id),
    [visibleTokens, aggregateTokensListMap],
  );
  useEffect(() => {
    if (!isAllNetworks) return undefined;
    let active = true;
    void Promise.all(
      visibleNetworkIds.map(async (id) => {
        try {
          const result = await backgroundApiProxy.serviceNetwork.getNetwork({
            networkId: id,
          });
          return result?.id === id ? result : undefined;
        } catch {
          return undefined;
        }
      }),
    ).then((networks) => {
      if (active)
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
  }, [isAllNetworks, visibleNetworkIds]);

  const { snapshot, tokensByKey } = useMemo(() => {
    const rows: RowModel[] = [];
    const byKey = new Map<string, IAccountToken>();
    const targetCurrency = settings.currencyInfo?.id ?? '';
    const hidden = Boolean(settingsValue.hideValue && hideValue);
    for (const token of visibleTokens) {
      const key = token.$key;
      if (
        typeof key === 'string' &&
        key &&
        key.length <= 256 &&
        !byKey.has(key)
      ) {
        byKey.set(key, token);
        const fiat: ITokenFiat | undefined =
          tokenMap[key] ?? hostAggregateTokenFiatMap[key];
        const balance = fiat
          ? tokenRebaseUtils.applyBalanceMultiplier({
              amount: fiat.balanceParsed,
              balanceMultiplier: fiat.balanceMultiplier,
            })
          : undefined;
        let balanceText: ReturnType<typeof formatNativeAmount> = { text: '' };
        if (fiat) {
          balanceText = hidden
            ? { text: '****' }
            : formatNativeAmount(
                String(displayOrUnavailable(balance)),
                'balance',
              );
        }
        const amount = fiat
          ? displayFiatValueOrUnavailable(fiat.fiatValue, balance)
          : '';
        const fiatValue =
          amount && amount !== '-'
            ? convertFiat({
                value: amount,
                sourceCurrency: fiat?.currency ?? targetCurrency,
                targetCurrency,
                currencyMap,
              })
            : amount;
        const unit =
          currencyMap[targetCurrency]?.unit ??
          currencyMap[fiat?.currency ?? '']?.unit;
        let valueText: ReturnType<typeof formatNativeAmount> = { text: '' };
        if (fiat) {
          valueText = hidden
            ? { text: '****' }
            : formatNativeAmount(String(fiatValue), 'value', {
                currency: unit,
              });
        }
        const price = fiat ? displayOrUnavailable(fiat.price) : '-';
        const convertedPrice =
          price === '-'
            ? '-'
            : convertFiat({
                value: price,
                sourceCurrency: fiat?.currency ?? targetCurrency,
                targetCurrency,
                currencyMap,
              });
        const priceText = formatNativeAmount(convertedPrice, 'price', {
          currency: unit,
        });
        const priceChange = fiat?.price24h;
        const priceChangeStyle = isValidNumberValue(priceChange)
          ? getTokenPriceChangeStyle({ priceChange })
          : undefined;
        const changeText = formatNativeAmount(
          isValidNumberValue(priceChange) ? String(priceChange) : '-',
          'priceChange',
          { showPlusMinusSigns: priceChangeStyle?.showPlusMinusSigns },
        );
        const aggregateMembers = aggregateTokensListMap?.[key]?.tokens ?? [];
        const allMembers = allAggregateTokenMap?.[key]?.tokens ?? [];
        const memberFiatMap: Record<string, ITokenFiat> = Object.fromEntries(
          aggregateMembers.flatMap((member) => {
            const data = tokenMap[member.$key];
            return data ? [[member.$key, data]] : [];
          }),
        );
        const { tokenHasBalance, tokenHasBalanceCount } = token.isAggregateToken
          ? checkIsOnlyOneTokenHasBalance({
              tokenMap: memberFiatMap,
              aggregateTokenList: aggregateMembers,
              allAggregateTokenList: allMembers,
            })
          : { tokenHasBalance: undefined, tokenHasBalanceCount: 0 };
        const firstMember = aggregateMembers[0];
        const selectedNetworkId =
          (firstMember?.networkId &&
            aggregateMembers.length === 1 &&
            allMembers.length === 0) ||
          (tokenHasBalance && tokenHasBalanceCount === 1)
            ? (tokenHasBalance?.networkId ?? firstMember?.networkId ?? '')
            : (token.networkId ?? '');
        const network =
          fetchedNetworks[selectedNetworkId] ??
          networkUtils.getLocalNetworkInfo(selectedNetworkId);
        const tokenLogo = imageUri(token.logoURI);
        const showReceiptHelp =
          !platformEnv.isNative && isTokenSelectorDappToken(token);
        const showGasHelp = Boolean(token.isNative && !isAllNetworks);
        const gasIcon = showGasHelp
          ? {
              name: 'GasSolid' as const,
              tintColor: colors.iconSubdued.val,
              hoverActionKey: platformEnv.isNative ? undefined : 'gas-info',
            }
          : undefined;
        const receiptIcon = showReceiptHelp
          ? {
              name: 'TicketOutline' as const,
              tintColor: colors.iconSubdued.val,
              hoverActionKey: 'receipt-info',
            }
          : undefined;
        let iconBackground = colors.gray5.val;
        if (tokenLogo) {
          iconBackground =
            themeVariant === 'light'
              ? colors.bgApp.val
              : colors.neutral6Dark.val;
        }
        let changeTone: 'positive' | 'negative' | 'secondary' = 'secondary';
        if (priceChangeStyle?.changeColor === '$textSuccess') {
          changeTone = 'positive';
        } else if (priceChangeStyle?.changeColor === '$textCritical') {
          changeTone = 'negative';
        }
        const networkLogo = imageUri(network?.logoURI);
        const overlays: VisualOverlay[] = [];
        if (isAllNetworks && network?.isCustomNetwork && network.name) {
          overlays.push({
            position: 'bottomRight',
            size: 20,
            offset: 4,
            backgroundColor: colors.bgApp.val,
          });
          overlays.push({
            position: 'bottomRight',
            size: 16,
            offset: 2,
            text: Array.from(network.name)[0]?.toUpperCase(),
            tintColor: colors.textInverse.val,
            backgroundColor: colors.bgInverse.val,
            fontWeight: 'semibold',
          });
        } else if (
          isAllNetworks &&
          selectedNetworkId &&
          !networkLogo &&
          (networkUtils.isAllNetwork({ networkId: selectedNetworkId }) ||
            networkUtils.isAggregateNetwork({ networkId: selectedNetworkId }))
        ) {
          overlays.push({
            position: 'bottomRight',
            name: 'AllNetworksSolid',
            size: 20,
            padding: 2,
            offset: 4,
            backgroundColor: colors.bgApp.val,
            tintColor: colors.iconActive.val,
          });
        } else if (isAllNetworks && selectedNetworkId) {
          overlays.push({
            position: 'bottomRight',
            size: 20,
            offset: 4,
            padding: 2,
            backgroundColor: colors.bgApp.val,
            image: networkLogo
              ? { uri: networkLogo, width: 16, height: 16 }
              : undefined,
            ...(networkLogo
              ? {
                  fallbackIcon: {
                    name: 'GlobusOutline',
                    tintColor: colors.iconSubdued.val,
                  },
                }
              : {
                  name: 'GlobusOutline',
                  tintColor: colors.iconSubdued.val,
                }),
          });
        }
        rows.push({
          key,
          type: 'identity',
          height: 60,
          testID: `home-token-item-${token.networkId ?? 'any'}-${token.symbol ?? key}`,
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
            overlays,
            fallbackIcon: {
              name: 'CryptoCoinOutline',
              tintColor: colors.iconSubdued.val,
              size: gtMd ? 24 : 28,
              backgroundColor: colors.gray5.val,
            },
            backgroundColor: iconBackground,
            borderColor:
              tokenLogo && themeVariant === 'dark'
                ? colors.neutral2Dark.val
                : undefined,
          },
          title: token.isAggregateToken
            ? (token.commonSymbol ?? token.symbol ?? '')
            : (token.symbol ?? ''),
          titleIcon: receiptIcon ?? gasIcon,
          secondaryTitleIcon:
            showReceiptHelp && gasIcon
              ? { ...gasIcon, hoverActionKey: 'gas-info' }
              : undefined,
          subtitleSegments: [
            {
              text: priceText.text,
              textSegments: priceText.segments,
              tone: 'secondary',
            },
            {
              text: `\u00a0${changeText.text}`,
              textSegments: changeText.segments
                ? [{ text: '\u00a0' }, ...changeText.segments]
                : undefined,
              tone: changeTone,
            },
          ],
          trailing: [
            {
              kind: 'valuePair',
              primary: balanceText.text,
              secondary: valueText.text,
              primaryTextSegments: balanceText.segments,
              secondaryTextSegments: valueText.segments,
            },
          ],
          style: {
            container: { cornerRadius: 12 },
            horizontalPadding: 12,
            verticalPadding: 8,
            leadingGap: 12,
            image: {
              width: gtMd ? 32 : 40,
              height: gtMd ? 32 : 40,
              shape: 'circle',
            },
            title: {
              fontSize: 16,
              lineHeight: 24,
              fontWeight: 'medium',
              color: colors.text.val,
              lines: 1,
              truncate: 'tail',
            },
            subtitle: {
              lineHeight: 20,
              lines: 1,
              truncate: 'tail',
            },
          },
        });
      }
    }
    const nextSnapshot: NativeListSnapshot = {
      schemaVersion: 1,
      generation: 1,
      layout: { kind: 'linear', contentPaddingHorizontal: 8 },
      theme,
      rows,
    };
    return { snapshot: validateSnapshot(nextSnapshot), tokensByKey: byKey };
  }, [
    visibleTokens,
    tokenMap,
    hostAggregateTokenFiatMap,
    allAggregateTokenMap,
    aggregateTokensListMap,
    settings,
    settingsValue.hideValue,
    hideValue,
    currencyMap,
    theme,
    gtMd,
    colors,
    themeVariant,
    isAllNetworks,
    fetchedNetworks,
  ]);

  const { updateTokenListState, updateSearchKey } =
    useTokenListActions().current;

  const headerRight = useCallback(() => {
    if (!helpText) return null;

    return (
      <Popover
        title={intl.formatMessage({ id: ETranslations.low_value_assets })}
        renderTrigger={<HeaderIconButton icon="QuestionmarkOutline" />}
        renderContent={
          <YStack p="$5" gap="$2">
            {isString(helpText) ? (
              <SizableText>{helpText}</SizableText>
            ) : (
              helpText.map((text, index) => (
                <XStack key={index} gap="$2">
                  <Stack
                    w="$1.5"
                    h="$1.5"
                    bg="$textSubdued"
                    borderRadius="$full"
                    mt="$2"
                  />
                  <SizableText size="$bodyMd">{text}</SizableText>
                </XStack>
              ))
            )}
          </YStack>
        }
      />
    );
  }, [helpText, intl]);

  const handleOnPressToken = useCallback(
    (token: IAccountToken) => {
      navigation.push(EModalAssetDetailRoutes.TokenDetails, {
        accountId: token.accountId ?? accountId,
        networkId: token.networkId ?? networkId,
        walletId,
        isBlocked,
        deriveInfo,
        deriveType,
        isAllNetworks,
        indexedAccountId: indexedAccountId ?? '',
        tokenInfo: token,
        aggregateTokens: aggregateTokensListMap?.[token.$key]?.tokens ?? [],
        tokenMap,
        accountAddress,
      });
    },
    [
      accountId,
      aggregateTokensListMap,
      deriveInfo,
      deriveType,
      indexedAccountId,
      isAllNetworks,
      isBlocked,
      navigation,
      networkId,
      tokenMap,
      walletId,
      accountAddress,
    ],
  );

  useEffect(() => {
    if (keys && tokens && tokenMap) {
      perfTokenListView.markEnd('tokenListRefreshing_tokenListPageUseEffect');
      updateTokenListState({ initialized: true, isRefreshing: false });
    }
  }, [keys, tokenMap, tokens, updateTokenListState]);

  const closeGasTooltip = useCallback(() => {
    const anchorToken = activeTooltipToken.current;
    activeTooltipToken.current = undefined;
    if (anchorToken)
      listRef.current?.setActionAnchorState({
        token: anchorToken,
        open: false,
      });
    setGasTooltip(undefined);
  }, []);
  useEffect(() => {
    closeGasTooltip();
  }, [closeGasTooltip, snapshot]);
  useEffect(
    () => () => {
      const anchorToken = activeTooltipToken.current;
      if (anchorToken)
        listRef.current?.setActionAnchorState({
          token: anchorToken,
          open: false,
        });
    },
    [],
  );
  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      const token = tokensByKey.get(event.rowKey ?? '');
      if (!token) return;
      if (event.actionKey === 'press') {
        (onPressToken ?? handleOnPressToken)(token);
      } else if (
        (event.actionKey === 'gas-info' ||
          event.actionKey === 'receipt-info') &&
        !platformEnv.isNative &&
        (event.actionKey === 'receipt-info'
          ? isTokenSelectorDappToken(token)
          : token.isNative && !isAllNetworks) &&
        event.anchor?.source === 'leadingAction'
      ) {
        const anchor = event.anchor;
        closeGasTooltip();
        activeTooltipToken.current = anchor.token;
        listRef.current?.setActionAnchorState({
          token: anchor.token,
          open: true,
        });
        containerRef.current?.measureInWindow((x, y) => {
          if (activeTooltipToken.current !== anchor.token) return;
          setGasTooltip({
            anchor,
            left: anchor.windowRect.x - x,
            top: anchor.windowRect.y - y,
            content: intl.formatMessage({
              id:
                event.actionKey === 'receipt-info'
                  ? ETranslations.wallet_defi_receipt_token__desc
                  : ETranslations.native_token_tooltip,
            }),
          });
        });
      }
    },
    [
      tokensByKey,
      onPressToken,
      handleOnPressToken,
      isAllNetworks,
      closeGasTooltip,
      intl,
    ],
  );

  return (
    <Page>
      <Page.Header
        title={title}
        headerRight={headerRight}
        headerSearchBarOptions={
          tokens.length >= ENABLE_SEARCH_TOKEN_LIST_MIN_LENGTH
            ? {
                onChangeText: debounce(
                  (e: NativeSyntheticEvent<TextInputFocusEventData>) =>
                    updateSearchKey(e.nativeEvent.text),
                  SEARCH_DEBOUNCE_INTERVAL,
                ),
                placeholder: intl.formatMessage({
                  id: ETranslations.global_search,
                }),
              }
            : undefined
        }
      />
      <Page.Body>
        <Stack ref={containerRef} flex={1} minHeight={0} position="relative">
          <NativeList
            ref={listRef}
            style={{ flex: 1 }}
            snapshot={snapshot}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            onRowAction={handleRowAction}
            onActionAnchorInvalidated={(event) => {
              if (activeTooltipToken.current === event.token) closeGasTooltip();
            }}
            listEmpty={searchKey ? <EmptySearch /> : <EmptyToken />}
          />
          {gasTooltip ? (
            <Stack
              position="absolute"
              left={gasTooltip.left}
              top={gasTooltip.top}
              width={gasTooltip.anchor.windowRect.width}
              height={gasTooltip.anchor.windowRect.height}
              pointerEvents="box-none"
            >
              <LazyTooltip
                open
                triggerAsChild
                placement="bottom"
                offset={6}
                onOpenChange={(open) => {
                  if (!open) closeGasTooltip();
                }}
                renderTrigger={
                  <Stack
                    width={gasTooltip.anchor.windowRect.width}
                    height={gasTooltip.anchor.windowRect.height}
                    pointerEvents="none"
                  />
                }
                renderContent={gasTooltip.content}
              />
            </Stack>
          ) : null}
        </Stack>
      </Page.Body>
    </Page>
  );
}

function TokenList() {
  const route =
    useRoute<
      RouteProp<IModalAssetListParamList, EModalAssetListRoutes.TokenList>
    >();
  const navigation = useAppNavigation();
  const intl = useIntl();

  // An orphaned modal can select this default route without account params.
  // Keep it recoverable without mounting account-dependent token content.
  if (!route.params) {
    return (
      <Page>
        <Page.Header />
        <Page.Body>
          <YStack
            flex={1}
            alignItems="center"
            justifyContent="center"
            gap="$4"
            p="$5"
          >
            <SizableText textAlign="center">
              {intl.formatMessage({
                id: ETranslations.global_unknown_error_retry_message,
              })}
            </SizableText>
            <Button
              testID="token-list-missing-params-back"
              onPress={() => navigation.popToMainRoute()}
            >
              {intl.formatMessage({ id: ETranslations.global_back })}
            </Button>
          </YStack>
        </Page.Body>
      </Page>
    );
  }

  return <TokenListContent params={route.params} />;
}

const TokenListWithProvider = memo(withTokenListProvider(TokenList));
TokenListWithProvider.displayName = 'TokenListWithProvider';

export { TokenList, TokenListWithProvider };

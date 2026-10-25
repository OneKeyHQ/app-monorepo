import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactElement, ReactNode } from 'react';

import { NativeList } from '@onekeyfe/react-native-native-list';
import { useIntl } from 'react-intl';

import {
  LazyTooltip,
  SizableText,
  Stack,
  useMedia,
} from '@onekeyhq/components';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import {
  ETokenSelectorSyntheticRowType,
  isTokenSelectorSyntheticRow,
} from '@onekeyhq/shared/src/utils/tokenSelectorCrossNetworkUtils';
import type { ITokenSelectorListRow } from '@onekeyhq/shared/src/utils/tokenSelectorCrossNetworkUtils';
import { isTokenSelectorDappToken } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { checkIsOnlyOneTokenHasBalance } from '@onekeyhq/shared/src/utils/tokenUtils';
import {
  UNAVAILABLE_DISPLAY,
  displayFiatValueOrUnavailable,
  displayOrUnavailable,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  useCreateAccountStateAtom,
  useProcessingTokenStateAtom,
} from '../../states/jotai/contexts/tokenList';
import { useAggregateSubTokenFiatMap } from '../../states/jotai/contexts/tokenList/cells/useAggregateSubTokenFiatMap';
import { useTokenFiat } from '../../states/jotai/contexts/tokenList/cells/useTokenFiat';
import { convertFiat } from '../../utils/fiatConvert';
import { useHomeNativeListTheme } from '../../views/Home/hooks/useHomeNativeListTheme';
import { ListLoading } from '../Loading';

import { formatNativeSelectorAmount } from './nativeSelectorFormat';
import { resolveMapTokenFiat } from './resolveMapTokenFiat';
import TokenActionsView from './TokenActionsView';

import type {
  DataRow,
  IdentityRow,
  NativeListActionAnchor,
  NativeListProps,
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
  RowModel,
  RowPatch,
  TrailingAccessory,
  VisualOverlay,
} from '@onekeyfe/react-native-native-list';

type IHomeCellValue = {
  fiat: ITokenFiat | undefined;
  memberFiatMap: Record<string, ITokenFiat>;
};
const EMPTY_HOME_CELL_VALUES: Record<string, IHomeCellValue> = {};
const EMPTY_SWAP_DISABLED: Record<string, boolean> = {};

function HomeTokenCellMirror({
  token,
  members,
  onChange,
}: {
  token: IAccountToken;
  members: IAccountToken[];
  onChange: (key: string, value: IHomeCellValue) => void;
}) {
  const fiat = useTokenFiat(token.$key);
  const memberFiatMap = useAggregateSubTokenFiatMap({
    aggKey: token.$key,
    aggregateTokenList: members,
    useCellSeam: true,
    contextTokenListMap: undefined,
  });
  useLayoutEffect(() => {
    onChange(token.$key, { fiat, memberFiatMap });
  }, [fiat, memberFiatMap, onChange, token.$key]);
  return null;
}

function TokenSwapMirror({
  token,
  onSwapActionChange,
}: {
  token: IAccountToken;
  onSwapActionChange: (
    key: string,
    state: { disabled: boolean; onPress: () => void } | null,
  ) => void;
}) {
  const publishSwapAction = useCallback(
    (state: { disabled: boolean; onPress: () => void }) => {
      onSwapActionChange(token.$key, state);
    },
    [onSwapActionChange, token.$key],
  );
  useEffect(
    () => () => onSwapActionChange(token.$key, null),
    [onSwapActionChange, token.$key],
  );
  return (
    <TokenActionsView token={token} nativeActionState={publishSwapAction} />
  );
}

function imageUri(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() && value.length <= 4096
    ? value
    : undefined;
}

function buildCellPatches(
  previous: NativeListSnapshot,
  next: NativeListSnapshot,
): RowPatch[] | undefined {
  if (
    previous.rows.length !== next.rows.length ||
    JSON.stringify(previous.layout) !== JSON.stringify(next.layout) ||
    JSON.stringify(previous.theme) !== JSON.stringify(next.theme) ||
    JSON.stringify(previous.capabilities) !==
      JSON.stringify(next.capabilities) ||
    JSON.stringify(previous.structuralTransition) !==
      JSON.stringify(next.structuralTransition)
  ) {
    return undefined;
  }
  const patches: RowPatch[] = [];
  for (let index = 0; index < next.rows.length; index += 1) {
    const oldRow = previous.rows[index];
    const row = next.rows[index];
    if (oldRow.key !== row.key || oldRow.type !== row.type) return undefined;
    if (oldRow !== row) {
      if (oldRow.type === 'dataRow' && row.type === 'dataRow') {
        const {
          columns: oldColumns,
          trailing: oldTrailing,
          ...oldMetadata
        } = oldRow;
        const { columns, trailing, ...metadata } = row;
        if ((oldTrailing === undefined) !== (trailing === undefined)) {
          return undefined;
        }
        if (
          JSON.stringify({ ...oldMetadata, asset: oldColumns[0] }) !==
          JSON.stringify({ ...metadata, asset: columns[0] })
        ) {
          return undefined;
        }
        if (
          JSON.stringify([oldColumns.slice(1), oldTrailing]) !==
          JSON.stringify([columns.slice(1), trailing])
        ) {
          patches.push({
            type: 'dataRow',
            key: row.key,
            changes: { columns, trailing },
          });
        }
      } else if (oldRow.type === 'identity' && row.type === 'identity') {
        const {
          subtitle: oldSubtitle,
          subtitleSegments: oldSubtitleSegments,
          trailing: oldTrailing,
          ...oldMetadata
        } = oldRow;
        const { subtitle, subtitleSegments, trailing, ...metadata } = row;
        if (
          (oldSubtitle === undefined) !== (subtitle === undefined) ||
          (oldTrailing === undefined) !== (trailing === undefined)
        ) {
          return undefined;
        }
        if (JSON.stringify(oldMetadata) !== JSON.stringify(metadata)) {
          return undefined;
        }
        if (
          JSON.stringify([oldSubtitle, oldSubtitleSegments, oldTrailing]) !==
          JSON.stringify([subtitle, subtitleSegments, trailing])
        ) {
          if (!!oldSubtitleSegments !== !!subtitleSegments) return undefined;
          patches.push({
            type: 'identity',
            key: row.key,
            changes: { subtitle, subtitleSegments, trailing },
          });
        }
      } else if (JSON.stringify(oldRow) !== JSON.stringify(row)) {
        return undefined;
      }
    }
  }
  return patches;
}

export function NativeTokenSelectorList({
  rows,
  networkId,
  networksMap,
  tokenListMap,
  aggregateTokenFiatMap,
  aggregateTokenListMap,
  allAggregateTokenMap,
  isAllNetworks,
  withNetwork,
  crossNetworkGroupingActive,
  showNetworkIcon,
  hideValue,
  hideBalanceAndValue,
  zeroFillMissingFiat,
  zeroFillNetworkIds,
  showProcessingState,
  isTokenSelector = false,
  isSearching,
  currentNetworkName,
  onPressToken,
  onSearchTokensRetry,
  empty,
  footerTipText,
  testID,
  tokenItemTestIDPrefix = 'token-selector-item',
  homeCellSeam,
  tableLayout,
  withPrice,
  withSwapAction,
  withAggregateBadge,
  rowKeys,
  header,
  footer,
  sidecar,
  sidecarLayout,
  structuralTransition,
  onRefresh,
  refreshing,
  webScrollHost,
  useExternalWebScrollHost,
  ownerKey,
}: {
  rows: ITokenSelectorListRow[];
  networkId: string;
  networksMap?: Record<string, IServerNetwork>;
  tokenListMap?: Record<string, ITokenFiat>;
  aggregateTokenFiatMap?: Record<string, ITokenFiat>;
  aggregateTokenListMap?: Record<string, { tokens: IAccountToken[] }>;
  allAggregateTokenMap?: Record<string, { tokens: IAccountToken[] }>;
  isAllNetworks?: boolean;
  withNetwork?: boolean;
  crossNetworkGroupingActive: boolean;
  showNetworkIcon?: boolean;
  hideValue?: boolean;
  hideBalanceAndValue?: boolean;
  zeroFillMissingFiat: boolean;
  zeroFillNetworkIds?: ReadonlySet<string>;
  showProcessingState: boolean;
  isTokenSelector?: boolean;
  isSearching: boolean;
  currentNetworkName: string;
  onPressToken?: (token: IAccountToken) => void;
  onSearchTokensRetry?: () => void;
  empty: ReactElement;
  footerTipText?: string;
  testID?: string;
  tokenItemTestIDPrefix?: string;
  homeCellSeam?: boolean;
  tableLayout?: boolean;
  withPrice?: boolean;
  withSwapAction?: boolean;
  withAggregateBadge?: boolean;
  rowKeys?: ReadonlyMap<string, string>;
  header?: ReactNode;
  footer?: ReactNode;
  sidecar?: ReactNode;
  sidecarLayout?: NativeListProps['sidecarLayout'];
  structuralTransition?: NativeListSnapshot['structuralTransition'];
  onRefresh?: () => void;
  refreshing?: boolean;
  webScrollHost?: HTMLElement | null;
  useExternalWebScrollHost?: boolean;
  ownerKey?: string;
}) {
  const intl = useIntl();
  const theme = useHomeNativeListTheme();
  const { gtMd } = useMedia();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [createAccountState] = useCreateAccountStateAtom();
  const [processingTokenState] = useProcessingTokenStateAtom();
  const hostAnchorRef = useRef<HTMLElement | null>(null);
  const listRef = useRef<NativeListRef>(null);
  const activeTooltipToken = useRef<string | undefined>(undefined);
  const [iconTooltip, setIconTooltip] = useState<{
    anchor: NativeListActionAnchor;
    left: number;
    top: number;
    content: string;
  }>();
  const [externalWebScrollHost, setExternalWebScrollHost] =
    useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!useExternalWebScrollHost || platformEnv.isNative) return;
    let node = hostAnchorRef.current?.parentElement ?? null;
    while (node) {
      if (node.getAttribute('data-collapsible-pager-scroll') === 'true') {
        setExternalWebScrollHost(node);
        return;
      }
      node = node.parentElement;
    }
  }, [useExternalWebScrollHost]);
  const [homeCellState, setHomeCellState] = useState<{
    ownerKey?: string;
    values: Record<string, IHomeCellValue>;
  }>({ values: {} });
  const homeCellValues =
    homeCellState.ownerKey === ownerKey
      ? homeCellState.values
      : EMPTY_HOME_CELL_VALUES;
  const swapActions = useRef(
    new Map<
      string,
      { disabled: boolean; onPress: () => void; ownerKey?: string }
    >(),
  );
  const [swapDisabledState, setSwapDisabled] = useState<{
    ownerKey?: string;
    values: Record<string, boolean>;
  }>({ values: {} });
  const swapDisabled =
    swapDisabledState.ownerKey === ownerKey
      ? swapDisabledState.values
      : EMPTY_SWAP_DISABLED;
  const onHomeCellChange = useCallback(
    (key: string, value: IHomeCellValue) => {
      setHomeCellState((prev) => {
        const values = prev.ownerKey === ownerKey ? prev.values : {};
        const current = values[key];
        if (
          current?.fiat === value.fiat &&
          current?.memberFiatMap === value.memberFiatMap
        ) {
          return prev;
        }
        return { ownerKey, values: { ...values, [key]: value } };
      });
    },
    [ownerKey],
  );
  const onSwapActionChange = useCallback(
    (key: string, state: { disabled: boolean; onPress: () => void } | null) => {
      if (state) {
        swapActions.current.set(key, { ...state, ownerKey });
      } else if (swapActions.current.get(key)?.ownerKey === ownerKey) {
        swapActions.current.delete(key);
      }
      setSwapDisabled((prev) => {
        const values = prev.ownerKey === ownerKey ? prev.values : {};
        const disabled = state?.disabled ?? true;
        return values[key] === disabled
          ? prev
          : { ownerKey, values: { ...values, [key]: disabled } };
      });
    },
    [ownerKey],
  );

  const rowCacheRef = useRef<{
    context: readonly unknown[];
    rows: Map<
      string,
      {
        token: IAccountToken;
        cellValue?: IHomeCellValue;
        swapDisabled?: boolean;
        fiat?: ITokenFiat;
        members?: IAccountToken[];
        allMembers?: IAccountToken[];
        memberFiatValues?: (ITokenFiat | undefined)[];
        row: RowModel;
      }
    >;
  } | null>(null);

  const { snapshot, tokenByKey, rowCache } = useMemo(() => {
    const nativeRows: RowModel[] = [];
    const byKey = new Map<string, IAccountToken>();
    const rowContext = [
      homeCellSeam,
      ownerKey,
      networkId,
      networksMap,
      homeCellSeam ? tokenListMap : undefined,
      homeCellSeam ? aggregateTokenFiatMap : undefined,
      homeCellSeam ? aggregateTokenListMap : undefined,
      homeCellSeam ? allAggregateTokenMap : undefined,
      isAllNetworks,
      withNetwork,
      crossNetworkGroupingActive,
      showNetworkIcon,
      hideValue,
      hideBalanceAndValue,
      zeroFillMissingFiat,
      zeroFillNetworkIds,
      showProcessingState,
      isTokenSelector,
      processingTokenState,
      createAccountState,
      currentNetworkName,
      tokenItemTestIDPrefix,
      rowKeys,
      tableLayout,
      withPrice,
      withSwapAction,
      withAggregateBadge,
      intl,
      settings.currencyInfo?.id,
      settingsValue.hideValue,
      gtMd,
      currencyMap,
      theme,
    ];
    const previousCache = rowCacheRef.current;
    const canReuseRows =
      previousCache?.context.length === rowContext.length &&
      previousCache.context.every((value, index) =>
        Object.is(value, rowContext[index]),
      );
    const nextRows = new Map<
      string,
      {
        token: IAccountToken;
        cellValue?: IHomeCellValue;
        swapDisabled?: boolean;
        fiat?: ITokenFiat;
        members?: IAccountToken[];
        allMembers?: IAccountToken[];
        memberFiatValues?: (ITokenFiat | undefined)[];
        row: RowModel;
      }
    >();
    const targetCurrency = settings.currencyInfo?.id ?? '';
    const iconSize = gtMd ? 32 : 40;
    for (const item of rows) {
      if (isTokenSelectorSyntheticRow(item)) {
        switch (item.syntheticRowType) {
          case ETokenSelectorSyntheticRowType.CurrentNetworkHeader:
          case ETokenSelectorSyntheticRowType.OtherNetworksHeader:
            nativeRows.push({
              type: 'sectionHeader',
              key: item.$key,
              sectionKey: item.$key,
              title:
                item.syntheticRowType ===
                ETokenSelectorSyntheticRowType.CurrentNetworkHeader
                  ? currentNetworkName
                  : intl.formatMessage({
                      id: ETranslations.token_selector_other_networks__title,
                    }),
            });
            break;
          case ETokenSelectorSyntheticRowType.CurrentNetworkNoMatch:
            nativeRows.push({
              type: 'system',
              variant: 'noMatch',
              key: item.$key,
              message: intl.formatMessage(
                { id: ETranslations.token_selector_no_match_on_network__desc },
                { network: currentNetworkName },
              ),
            });
            break;
          case ETokenSelectorSyntheticRowType.OtherNetworksSearchError:
            nativeRows.push({
              type: 'system',
              variant: 'retry',
              key: item.$key,
              testID: 'TokenSelector-CrossNetworkSearch-InlineRetry',
              message: intl.formatMessage({
                id: ETranslations.token_selector_other_networks_search_failed__msg,
              }),
              actionText: intl.formatMessage({
                id: ETranslations.global_retry,
              }),
              actionKey: 'retry',
            });
            break;
        }
      } else {
        const token = item;
        const key = token.$key;
        const rowKey = rowKeys?.get(key) ?? key;
        if (key && !byKey.has(rowKey)) {
          byKey.set(rowKey, token);
          const members = aggregateTokenListMap?.[key]?.tokens;
          const allMembers = allAggregateTokenMap?.[key]?.tokens;
          const memberFiatValues =
            !homeCellSeam && members?.length
              ? members.map((member) => tokenListMap?.[member.$key])
              : undefined;
          const fiat = homeCellSeam
            ? homeCellValues[key]?.fiat
            : resolveMapTokenFiat({
                $key: key,
                networkId: token.networkId,
                tokenListMap,
                aggregateTokenFiatMap,
                zeroFillMissingFiat,
                zeroFillNetworkIds,
              });
          const cached = canReuseRows
            ? previousCache?.rows.get(rowKey)
            : undefined;
          if (
            cached?.token === token &&
            cached.cellValue === homeCellValues[key] &&
            cached.swapDisabled === swapDisabled[key] &&
            cached.fiat === fiat &&
            cached.members === members &&
            cached.allMembers === allMembers &&
            cached.memberFiatValues?.length === memberFiatValues?.length &&
            (memberFiatValues?.every(
              (value, index) => cached.memberFiatValues?.[index] === value,
            ) ??
              true)
          ) {
            nativeRows.push(cached.row);
            nextRows.set(rowKey, cached);
          } else {
            const resolvedMembers = members ?? [];
            const resolvedAllMembers = allMembers ?? [];
            const memberFiatMap = homeCellSeam
              ? (homeCellValues[key]?.memberFiatMap ?? {})
              : Object.fromEntries(
                  resolvedMembers.flatMap((member) => {
                    const memberFiat = tokenListMap?.[member.$key];
                    return memberFiat ? [[member.$key, memberFiat]] : [];
                  }),
                );
            const { tokenHasBalance, tokenHasBalanceCount } =
              token.isAggregateToken
                ? checkIsOnlyOneTokenHasBalance({
                    tokenMap: memberFiatMap,
                    aggregateTokenList: resolvedMembers,
                    allAggregateTokenList: resolvedAllMembers,
                  })
                : { tokenHasBalance: undefined, tokenHasBalanceCount: 0 };
            const firstMember = resolvedMembers[0];
            const selectedNetworkId =
              (firstMember?.networkId &&
                resolvedMembers.length === 1 &&
                resolvedAllMembers.length === 0) ||
              (tokenHasBalance && tokenHasBalanceCount === 1)
                ? (tokenHasBalance?.networkId ?? firstMember?.networkId ?? '')
                : (token.networkId ?? '');
            const network =
              networksMap?.[selectedNetworkId] ??
              networkUtils.getLocalNetworkInfo(selectedNetworkId);
            const tokenLogo = imageUri(token.logoURI);
            const networkLogo = imageUri(network?.logoURI);
            const overlays: VisualOverlay[] = [];
            if (isAllNetworks && showNetworkIcon && selectedNetworkId) {
              if (network?.isCustomNetwork && network.name) {
                overlays.push({
                  position: 'bottomRight',
                  size: 20,
                  offset: 4,
                  backgroundColor: theme.background,
                });
                overlays.push({
                  position: 'bottomRight',
                  size: 16,
                  offset: 2,
                  text: network.name[0]?.toUpperCase(),
                  tintColor: theme.inverseText,
                  backgroundColor: theme.inverseBackground,
                  fontWeight: 'semibold',
                });
              } else if (
                !networkLogo &&
                (networkUtils.isAllNetwork({ networkId: selectedNetworkId }) ||
                  networkUtils.isAggregateNetwork({
                    networkId: selectedNetworkId,
                  }))
              ) {
                overlays.push({
                  position: 'bottomRight',
                  name: 'AllNetworksSolid',
                  size: 20,
                  padding: 2,
                  offset: 4,
                  backgroundColor: theme.background,
                  tintColor: theme.accent,
                });
              } else {
                overlays.push({
                  position: 'bottomRight',
                  size: 20,
                  offset: 4,
                  padding: 2,
                  backgroundColor: theme.background,
                  image: networkLogo
                    ? { uri: networkLogo, width: 16, height: 16 }
                    : undefined,
                  ...(networkLogo
                    ? {
                        fallbackIcon: {
                          name: 'GlobusOutline',
                          tintColor: theme.iconSubdued,
                        },
                      }
                    : { name: 'GlobusOutline', tintColor: theme.iconSubdued }),
                });
              }
            }
            const balance = tokenRebaseUtils.applyBalanceMultiplier({
              amount: fiat?.balanceParsed,
              balanceMultiplier: fiat?.balanceMultiplier,
            });
            let balanceText: ReturnType<typeof formatNativeSelectorAmount> = {
              text: '',
            };
            if (fiat) {
              balanceText =
                settingsValue.hideValue && hideValue
                  ? { text: '****' }
                  : formatNativeSelectorAmount(
                      String(displayOrUnavailable(balance)),
                      'balance',
                    );
            }
            const unit =
              currencyMap[targetCurrency]?.unit ??
              currencyMap[fiat?.currency ?? '']?.unit;
            const rawPrice = displayOrUnavailable(fiat?.price);
            const convertedPrice =
              rawPrice === UNAVAILABLE_DISPLAY
                ? rawPrice
                : convertFiat({
                    value: rawPrice,
                    sourceCurrency: fiat?.currency ?? targetCurrency,
                    targetCurrency,
                    currencyMap,
                  });
            const priceText = formatNativeSelectorAmount(
              String(convertedPrice),
              'price',
              unit,
            );
            const priceChangeValid = isValidNumberValue(fiat?.price24h);
            const priceChangeValue = priceChangeValid
              ? Number(fiat?.price24h)
              : undefined;
            const priceChangeText = formatNativeSelectorAmount(
              priceChangeValue === undefined
                ? UNAVAILABLE_DISPLAY
                : String(priceChangeValue),
              'priceChange',
              undefined,
              priceChangeValue !== undefined && priceChangeValue !== 0,
            );
            let priceChangeTone: 'secondary' | 'positive' | 'negative' =
              'secondary';
            if (priceChangeValue !== undefined && priceChangeValue > 0) {
              priceChangeTone = 'positive';
            } else if (priceChangeValue !== undefined && priceChangeValue < 0) {
              priceChangeTone = 'negative';
            }
            const amount = fiat
              ? displayFiatValueOrUnavailable(fiat.fiatValue, balance)
              : '';
            const converted =
              amount && amount !== UNAVAILABLE_DISPLAY
                ? convertFiat({
                    value: amount,
                    sourceCurrency: fiat?.currency ?? targetCurrency,
                    targetCurrency,
                    currencyMap,
                  })
                : amount;
            let valueText: ReturnType<typeof formatNativeSelectorAmount> = {
              text: '',
            };
            if (fiat) {
              valueText =
                settingsValue.hideValue && hideValue
                  ? { text: '****' }
                  : formatNativeSelectorAmount(
                      String(converted),
                      'value',
                      unit,
                    );
            }
            const currentProcessing =
              showProcessingState &&
              processingTokenState.isProcessing &&
              processingTokenState.token?.$key === key;
            const otherProcessing =
              showProcessingState &&
              processingTokenState.isProcessing &&
              processingTokenState.token?.$key !== key;
            const creatingAddress =
              createAccountState.isCreating &&
              createAccountState.token?.$key === key &&
              createAccountState.token?.networkId === token.networkId;
            const rowWithNetwork =
              withNetwork ||
              (crossNetworkGroupingActive && token.networkId !== networkId);
            const badgeNetwork =
              rowWithNetwork &&
              ((network &&
                !network.isAggregateNetwork &&
                !token.isAggregateToken) ||
                (firstMember &&
                  resolvedMembers.length === 1 &&
                  resolvedAllMembers.length === 0) ||
                (tokenHasBalance && tokenHasBalanceCount === 1))
                ? network?.name
                : undefined;
            const gasIcon: IdentityRow['titleIcon'] =
              token.isNative && !isAllNetworks
                ? {
                    name: 'GasSolid',
                    tintColor: theme.iconSubdued,
                    accessibilityLabel: intl.formatMessage({
                      id: ETranslations.native_token_tooltip,
                    }),
                    hoverActionKey: platformEnv.isNative
                      ? undefined
                      : 'gas-info',
                  }
                : undefined;
            const receiptIcon: IdentityRow['titleIcon'] =
              !platformEnv.isNative && isTokenSelectorDappToken(token)
                ? {
                    name: 'TicketOutline',
                    tintColor: theme.iconSubdued,
                    accessibilityLabel: intl.formatMessage({
                      id: ETranslations.wallet_defi_receipt_token__desc,
                    }),
                    hoverActionKey: 'receipt-info',
                  }
                : undefined;
            const titleIcon = receiptIcon ?? gasIcon;
            const secondaryTitleIcon = receiptIcon ? gasIcon : undefined;
            const trailing: TrailingAccessory[] = [];
            if (!creatingAddress && !hideBalanceAndValue && fiat) {
              trailing.push({
                kind: 'valuePair',
                primary: balanceText.text,
                secondary: valueText.text,
                primaryTextSegments: balanceText.segments,
                secondaryTextSegments: valueText.segments,
              });
            }
            if (creatingAddress) {
              trailing.push({
                kind: 'value',
                text: intl.formatMessage({
                  id: ETranslations.global_creating_address,
                }),
                secondary: true,
              });
            }
            if (creatingAddress || currentProcessing) {
              trailing.push({ kind: 'spinner' });
            }
            const leading: IdentityRow['leading'] = {
              kind: 'token',
              image: tokenLogo
                ? {
                    uri: tokenLogo,
                    width: iconSize,
                    height: iconSize,
                    loadingStrategy: 'skeleton',
                  }
                : undefined,
              overlays,
              fallbackIcon: {
                name: 'CryptoCoinOutline',
                tintColor: theme.iconSubdued,
                size: gtMd ? 24 : 28,
              },
            };
            const nativeRow: IdentityRow = {
              type: 'identity',
              key: rowKey,
              height: 60,
              testID: `${tokenItemTestIDPrefix}-${token.networkId ?? 'any'}-${token.symbol ?? key}`,
              title: token.isAggregateToken
                ? (token.commonSymbol ?? token.symbol ?? '')
                : (token.symbol ?? ''),
              subtitle:
                !isTokenSelector && withPrice
                  ? `${priceText.text} ${priceChangeText.text}`
                  : token.name,
              ...(!isTokenSelector && withPrice
                ? {
                    subtitleSegments: [
                      {
                        text: priceText.text,
                        textSegments: priceText.segments,
                        tone: 'secondary' as const,
                      },
                      {
                        text: priceChangeText.text,
                        textSegments: priceChangeText.segments,
                        tone: priceChangeTone,
                        separatorBefore: true,
                      },
                    ],
                  }
                : undefined),
              titleIcon,
              secondaryTitleIcon,
              badges: [
                ...(isAllNetworks &&
                (withAggregateBadge || isTokenSelector) &&
                token.isAggregateToken &&
                (resolvedMembers.length > 1 || resolvedAllMembers.length > 1) &&
                !tokenHasBalance
                  ? [
                      {
                        key: 'multichain',
                        text: intl.formatMessage({
                          id: ETranslations.global__multichain,
                        }),
                      },
                    ]
                  : []),
                ...(badgeNetwork
                  ? [{ key: 'network', text: badgeNetwork }]
                  : []),
              ],
              leading,
              trailing,
              disabled: !!otherProcessing,
              opacity: otherProcessing ? 0.5 : 1,
              style: {
                horizontalPadding: 12,
                verticalPadding: 8,
                leadingGap: 12,
                image: { width: iconSize, height: iconSize, shape: 'circle' },
                title: { token: '$bodyLg', fontWeight: 'medium', lines: 1 },
                subtitle: {
                  token: '$bodyMd',
                  lines: 1,
                },
              },
            };
            if (tableLayout && !isTokenSelector) {
              const swapAction: TrailingAccessory[] = withSwapAction
                ? [
                    {
                      kind: 'button',
                      label: intl.formatMessage({
                        id: ETranslations.global_swap,
                      }),
                      actionKey: 'swap',
                      disabled: swapDisabled[key] ?? true,
                      testID: 'token-actions-swap-btn',
                      textColor: theme.primaryText,
                      backgroundColor: theme.subduedBackground,
                    },
                  ]
                : [];
              const tableRow: DataRow = {
                type: 'dataRow',
                key: rowKey,
                height: 60,
                testID: nativeRow.testID,
                leading,
                badges: nativeRow.badges,
                columns: [
                  {
                    key: 'asset',
                    text: nativeRow.title,
                    secondaryText: token.name,
                    titleIcon,
                    secondaryTitleIcon,
                    weight: 1,
                  },
                  {
                    key: 'balance',
                    text: balanceText.text,
                    textSegments: balanceText.segments,
                    secondaryText: valueText.text,
                    secondaryTextSegments: valueText.segments,
                    alignment: 'end',
                    weight: 1,
                  },
                  {
                    key: 'price',
                    text: priceText.text,
                    textSegments: priceText.segments,
                    secondaryText: priceChangeText.text,
                    secondaryTextSegments: priceChangeText.segments,
                    secondaryTone: priceChangeTone,
                    alignment: 'end',
                    weight: 1,
                  },
                ],
                trailing: swapAction,
                style: {
                  horizontalPadding: 12,
                  verticalPadding: 8,
                  leadingGap: 12,
                  columns: {
                    token: '$bodyLg',
                    fontWeight: 'medium',
                    lines: 1,
                  },
                  columnSecondary: {
                    token: '$bodyMd',
                    lines: 1,
                  },
                  image: { width: iconSize, height: iconSize, shape: 'circle' },
                },
              };
              nativeRows.push(tableRow);
              nextRows.set(rowKey, {
                token,
                cellValue: homeCellValues[key],
                swapDisabled: swapDisabled[key],
                fiat,
                members,
                allMembers,
                memberFiatValues,
                row: tableRow,
              });
            } else {
              nativeRows.push(nativeRow);
              nextRows.set(rowKey, {
                token,
                cellValue: homeCellValues[key],
                swapDisabled: swapDisabled[key],
                fiat,
                members,
                allMembers,
                memberFiatValues,
                row: nativeRow,
              });
            }
          }
        }
      }
    }
    const nextSnapshot: NativeListSnapshot = {
      schemaVersion: 1,
      generation: 1,
      layout: { kind: 'linear', contentPaddingHorizontal: 8 },
      rows: nativeRows,
      theme,
      ...(structuralTransition ? { structuralTransition } : undefined),
      ...(onRefresh
        ? {
            capabilities: {
              pullToRefresh: true,
              refreshing: !!refreshing,
              refreshTriggerDistance: 65,
            },
          }
        : undefined),
    };
    return {
      snapshot: nextSnapshot,
      tokenByKey: byKey,
      rowCache: { context: rowContext, rows: nextRows },
    };
  }, [
    rows,
    ownerKey,
    networkId,
    networksMap,
    tokenListMap,
    aggregateTokenFiatMap,
    aggregateTokenListMap,
    allAggregateTokenMap,
    isAllNetworks,
    withNetwork,
    crossNetworkGroupingActive,
    showNetworkIcon,
    hideValue,
    hideBalanceAndValue,
    zeroFillMissingFiat,
    zeroFillNetworkIds,
    showProcessingState,
    isTokenSelector,
    processingTokenState,
    createAccountState,
    currentNetworkName,
    tokenItemTestIDPrefix,
    homeCellSeam,
    homeCellValues,
    rowKeys,
    tableLayout,
    withPrice,
    withSwapAction,
    withAggregateBadge,
    swapDisabled,
    structuralTransition,
    onRefresh,
    refreshing,
    intl,
    settings.currencyInfo?.id,
    settingsValue.hideValue,
    gtMd,
    currencyMap,
    theme,
  ]);

  useLayoutEffect(() => {
    rowCacheRef.current = rowCache;
  }, [rowCache]);

  const appliedSnapshotRef = useRef<NativeListSnapshot | undefined>(undefined);
  const propSnapshotRef = useRef<NativeListSnapshot | undefined>(undefined);
  const appliedOwnerKeyRef = useRef<string | undefined>(undefined);
  const rowPatches =
    appliedSnapshotRef.current && appliedOwnerKeyRef.current === ownerKey
      ? buildCellPatches(appliedSnapshotRef.current, snapshot)
      : undefined;
  const snapshotForList =
    rowPatches !== undefined ? (propSnapshotRef.current ?? snapshot) : snapshot;
  useLayoutEffect(() => {
    if (rowPatches?.length) {
      listRef.current?.applyPatches(rowPatches);
    }
    appliedSnapshotRef.current = snapshot;
    if (rowPatches === undefined) {
      propSnapshotRef.current = snapshot;
    }
    appliedOwnerKeyRef.current = ownerKey;
  }, [rowPatches, ownerKey, snapshot]);

  const closeIconTooltip = useCallback(() => {
    const token = activeTooltipToken.current;
    activeTooltipToken.current = undefined;
    if (token) {
      listRef.current?.setActionAnchorState({ token, open: false });
    }
    setIconTooltip(undefined);
  }, []);
  useEffect(
    () => () => {
      const token = activeTooltipToken.current;
      if (token) {
        listRef.current?.setActionAnchorState({ token, open: false });
      }
    },
    [],
  );

  const onRowAction = useCallback(
    (event: RowActionEvent) => {
      if (event.actionKey === 'retry') {
        onSearchTokensRetry?.();
      } else if (event.actionKey === 'swap') {
        const token = tokenByKey.get(event.rowKey ?? '');
        if (token) {
          const action = swapActions.current.get(token.$key);
          if (action && action.ownerKey === ownerKey && !action.disabled) {
            action.onPress();
          }
        }
      } else if (event.actionKey === 'press') {
        const token = tokenByKey.get(event.rowKey ?? '');
        if (token) onPressToken?.(token);
      } else if (
        !platformEnv.isNative &&
        (event.actionKey === 'gas-info' ||
          event.actionKey === 'receipt-info') &&
        event.anchor?.source === 'leadingAction'
      ) {
        const token = tokenByKey.get(event.rowKey ?? '');
        if (
          !token ||
          (event.actionKey === 'gas-info'
            ? !token.isNative || !!isAllNetworks
            : !isTokenSelectorDappToken(token))
        ) {
          return;
        }
        const anchor = event.anchor;
        const rootRect = hostAnchorRef.current?.getBoundingClientRect();
        if (!rootRect) return;
        closeIconTooltip();
        activeTooltipToken.current = anchor.token;
        listRef.current?.setActionAnchorState({
          token: anchor.token,
          open: true,
        });
        setIconTooltip({
          anchor,
          left: anchor.windowRect.x - rootRect.x,
          top: anchor.windowRect.y - rootRect.y,
          content: intl.formatMessage({
            id:
              event.actionKey === 'receipt-info'
                ? ETranslations.wallet_defi_receipt_token__desc
                : ETranslations.native_token_tooltip,
          }),
        });
      }
    },
    [
      closeIconTooltip,
      intl,
      isAllNetworks,
      onPressToken,
      onSearchTokensRetry,
      ownerKey,
      tokenByKey,
    ],
  );

  return (
    <Stack
      ref={hostAnchorRef as never}
      position="relative"
      {...(useExternalWebScrollHost && !platformEnv.isNative
        ? undefined
        : { flex: 1 })}
    >
      {homeCellSeam
        ? rows.map((item) =>
            isTokenSelectorSyntheticRow(item) ? null : (
              <HomeTokenCellMirror
                key={item.$key}
                token={item}
                members={aggregateTokenListMap?.[item.$key]?.tokens ?? []}
                onChange={onHomeCellChange}
              />
            ),
          )
        : null}
      {withSwapAction && tableLayout
        ? rows.map((item) =>
            isTokenSelectorSyntheticRow(item) ? null : (
              <TokenSwapMirror
                key={`swap-${item.$key}`}
                token={item}
                onSwapActionChange={onSwapActionChange}
              />
            ),
          )
        : null}
      <NativeList
        ref={listRef}
        testID={testID}
        style={
          useExternalWebScrollHost && !platformEnv.isNative
            ? undefined
            : { flex: 1 }
        }
        snapshot={snapshotForList}
        listHeader={header}
        listEmpty={empty}
        listFooter={
          <>
            <Stack>
              {isSearching && rows.length ? (
                <ListLoading isTokenSelectorView={!tableLayout} />
              ) : null}
              {footerTipText ? (
                <Stack jc="center" ai="center" pt="$3">
                  <SizableText size="$bodySm" color="$textSubdued">
                    {footerTipText}
                  </SizableText>
                </Stack>
              ) : null}
            </Stack>
            {footer}
          </>
        }
        listSidecar={platformEnv.isNative ? (sidecar ?? undefined) : undefined}
        sidecarLayout={platformEnv.isNative ? sidecarLayout : undefined}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        onRowAction={onRowAction}
        onActionAnchorInvalidated={(event) => {
          if (activeTooltipToken.current === event.token) closeIconTooltip();
        }}
        onRefresh={onRefresh}
        {...(platformEnv.isNative
          ? undefined
          : {
              webScrollHost: useExternalWebScrollHost
                ? externalWebScrollHost
                : webScrollHost,
            })}
      />
      {iconTooltip && !platformEnv.isNative ? (
        <Stack
          position="absolute"
          left={iconTooltip.left}
          top={iconTooltip.top}
          width={iconTooltip.anchor.windowRect.width}
          height={iconTooltip.anchor.windowRect.height}
          pointerEvents="box-none"
        >
          <LazyTooltip
            open
            triggerAsChild
            placement="bottom"
            offset={6}
            onOpenChange={(open) => {
              if (!open) closeIconTooltip();
            }}
            renderTrigger={
              <Stack
                width={iconTooltip.anchor.windowRect.width}
                height={iconTooltip.anchor.windowRect.height}
                pointerEvents="none"
              />
            }
            renderContent={iconTooltip.content}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

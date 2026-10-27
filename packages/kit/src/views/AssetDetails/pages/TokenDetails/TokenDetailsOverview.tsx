import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  NativeList,
  validateSnapshot,
} from '@onekeyfe/react-native-native-list';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  LazyTooltip,
  SizableText,
  Stack,
  Toast,
  useTheme,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AppPagerContent } from '@onekeyhq/kit/src/components/AppPager/AppPagerContent';
import { useAppPagerPage } from '@onekeyhq/kit/src/components/AppPager/useAppPagerPage';
import { ReviewControl } from '@onekeyhq/kit/src/components/ReviewControl';
import { useAccountData } from '@onekeyhq/kit/src/hooks/useAccountData';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useBotWalletDeactivatedStatus } from '@onekeyhq/kit/src/hooks/useBotWalletDeactivatedStatus';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import { useUserWalletProfile } from '@onekeyhq/kit/src/hooks/useUserWalletProfile';
import { showBotWalletDisabledToast } from '@onekeyhq/kit/src/utils/botWalletDisabledToast';
import { shouldBlockBotWalletReceive } from '@onekeyhq/kit/src/utils/botWalletStatusUtils';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import { formatPortfolioPercent } from '@onekeyhq/kit/src/views/Home/components/DeFiListBlock/formatPortfolioPercent';
import { RawActions } from '@onekeyhq/kit/src/views/Home/components/WalletActions/RawActions';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
  useSettingsValuePersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EAssetSelectorRoutes,
  EModalReceiveRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils, {
  isEnabledNetworksInAllNetworks,
} from '@onekeyhq/shared/src/utils/networkUtils';
import { numberFormatAsRenderText } from '@onekeyhq/shared/src/utils/numberUtils';
import { isSwapEntryDisabledToken } from '@onekeyhq/shared/src/utils/swapEntryUtils';
import tokenRebaseUtils from '@onekeyhq/shared/src/utils/tokenRebaseUtils';
import {
  displayFiatValueOrUnavailable,
  displayOrUnavailable,
  isValidNumberValue,
} from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { openFiatCryptoWidget } from './ActionBuy';
import TokenDetailsBalanceHero from './TokenDetailsBalanceHero';
import { useTokenDetailsContext } from './TokenDetailsContext';
import { TokenDetailsDeFiBlock } from './TokenDetailsDeFiBlock';
import { pushSwapFromTokenDetails } from './TokenDetailsHeader';
import { useAggregateTokenDetails } from './useAggregateTokenDetails';

import type {
  NativeListActionAnchor,
  NativeListRef,
  NativeListSnapshot,
  NativeListTheme,
  RowActionEvent,
  RowModel,
  ValueTextSegment,
} from '@onekeyfe/react-native-native-list';
import type { ViewInstance } from 'react-native';

type IProps = {
  accountId: string;
  networkId: string;
  walletId: string;
  indexedAccountId?: string;
  tokenInfo: IAccountToken;
  tokens: IAccountToken[];
  tokenMap?: Record<string, ITokenFiat>;
  isAllNetworks?: boolean;
  onSelectToken: (token: IAccountToken) => void;
};

function formatOverviewAmount(
  value: string,
  formatter: 'balance' | 'value',
  currency?: string,
): { text: string; segments?: readonly ValueTextSegment[] } {
  if (value === '-') return { text: '-' };
  const rendered = numberFormatAsRenderText(value, {
    formatter,
    formatterOptions: { currency },
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

function TokenDetailsOverview(props: IProps) {
  const {
    accountId,
    walletId,
    indexedAccountId,
    tokenInfo,
    tokens,
    tokenMap,
    isAllNetworks,
    onSelectToken,
  } = props;

  const intl = useIntl();
  const navigation = useAppNavigation();
  const colors = useTheme();
  const isRouteFocused = useRouteIsFocused();
  const pagerPage = useAppPagerPage();
  const [settings] = useSettingsPersistAtom();
  const [settingsValue] = useSettingsValuePersistAtom();
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const listRef = useRef<NativeListRef>(null);
  const containerRef = useRef<ViewInstance>(null);
  const activeTooltipToken = useRef<string | undefined>(undefined);
  const [detailTooltip, setDetailTooltip] = useState<{
    anchor: NativeListActionAnchor;
    left: number;
    top: number;
  }>();
  const [fetchedNetworks, setFetchedNetworks] = useState<
    Record<string, IServerNetwork>
  >({});
  const { wallet } = useAccountData({ accountId, walletId });
  const { isSoftwareWalletOnlyUser } = useUserWalletProfile();
  const { updateTokenDetails } = useTokenDetailsContext();

  const {
    rows,
    totalFiatValueBN,
    totalFiatValue,
    totalBalanceParsed,
    currency,
    hasBalanceData,
  } = useAggregateTokenDetails({ tokens, tokenMap });

  const isWatchOnly = wallet?.type === WALLET_TYPE_WATCHING;

  const { isBotWallet, isBotWalletDeactivated } = useBotWalletDeactivatedStatus(
    {
      walletId,
    },
  );
  const isBotWalletReceiveBlocked = shouldBlockBotWalletReceive({
    isBotWallet,
    isBotWalletDeactivated,
  });

  // Entry points other than the wallet home (e.g. universal search) do not
  // carry the full home fiat snapshot, and member tabs only fetch on focus —
  // which never happens while the user stays on Overview. Backfill the members
  // that have an address but no data yet; the fetched-keys set keeps re-runs
  // (rows change on every context update) from refetching.
  const backfilledKeysRef = useRef(new Set<string>());
  const { isLoading: isBackfillingDetails } = usePromiseResult(
    async () => {
      const missingRows = rows.filter(
        (row) =>
          !row.tokenDetail &&
          row.token.accountId &&
          row.token.networkId &&
          !backfilledKeysRef.current.has(row.token.$key),
      );
      if (!missingRows.length) {
        return;
      }
      // The home aggregate row only sums members on enabled networks, so
      // fetching a disabled member here would push the Overview total above
      // the home figure. Those members keep their "enable network" placeholder
      // row and stay unmarked so a later enable can still fill them in.
      let fetchableRows = missingRows;
      if (isAllNetworks) {
        const allNetworksState =
          await backgroundApiProxy.serviceAllNetwork.getAllNetworksState();
        fetchableRows = missingRows.filter(({ token }) =>
          isEnabledNetworksInAllNetworks({
            networkId: token.networkId ?? '',
            disabledNetworks: allNetworksState.disabledNetworks,
            enabledNetworks: allNetworksState.enabledNetworks,
            isTestnet: false,
          }),
        );
      }
      if (!fetchableRows.length) {
        return;
      }
      fetchableRows.forEach((row) =>
        backfilledKeysRef.current.add(row.token.$key),
      );
      await Promise.all(
        fetchableRows.map(async ({ token }) => {
          try {
            const resp =
              await backgroundApiProxy.serviceToken.fetchTokensDetails({
                accountId: token.accountId ?? '',
                networkId: token.networkId ?? '',
                contractList: [token.address],
              });
            const data = resp?.[0];
            if (data) {
              updateTokenDetails({
                accountId: token.accountId ?? '',
                networkId: token.networkId ?? '',
                isInit: true,
                data,
              });
            } else {
              // No data came back — unmark so a later run can retry instead of
              // leaving the row on its placeholder forever (member tabs only
              // fetch on focus, which never happens while staying on Overview).
              backfilledKeysRef.current.delete(token.$key);
            }
          } catch {
            // Transient failure — same retry rationale as the empty response.
            backfilledKeysRef.current.delete(token.$key);
          }
        }),
      );
    },
    [rows, isAllNetworks, updateTokenDetails],
    {
      watchLoading: true,
    },
  );

  const showLoadingState = !hasBalanceData && (isBackfillingDetails ?? true);

  const earnMembers = useMemo(
    () =>
      tokens
        .map((token) => ({
          networkId: token.networkId ?? '',
          address: token.address ?? '',
        }))
        .filter((member) => member.networkId),
    [tokens],
  );

  const handleSendPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
      screen: EModalSignatureConfirmRoutes.TxSelectAggregateToken,
      params: {
        accountId,
        indexedAccountId,
        aggregateToken: tokenInfo,
        aggregateSubTokenList: tokens,
        hideZeroBalanceTokens: true,
        enableNetworkAfterSelect: true,
        closeAfterSelect: false,
        onSelect: async (token: IAccountToken) => {
          defaultLogger.wallet.walletActions.actionSend({
            walletType: wallet?.type ?? '',
            networkId: token.networkId ?? '',
            source: 'tokenDetails',
            isSoftwareWalletOnlyUser,
          });

          const vaultSettings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: token.networkId ?? '',
            });

          let sendAccountId = token.accountId ?? '';
          if (
            vaultSettings.mergeDeriveAssetsEnabled &&
            isAllNetworks &&
            !accountUtils.isOthersWallet({ walletId })
          ) {
            const defaultDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: token.networkId ?? '',
                },
              );
            const { accounts } =
              await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts(
                {
                  indexedAccountIds: [indexedAccountId ?? ''],
                  networkId: token.networkId ?? '',
                  deriveType: defaultDeriveType,
                },
              );
            sendAccountId = accounts?.[0]?.id ?? sendAccountId;
          }

          navigation.push(EModalSignatureConfirmRoutes.TxDataInput, {
            accountId: sendAccountId,
            networkId: token.networkId ?? '',
            isNFT: false,
            token,
            isAllNetworks,
          });
        },
      },
    });
  }, [
    navigation,
    accountId,
    indexedAccountId,
    tokenInfo,
    tokens,
    wallet?.type,
    isSoftwareWalletOnlyUser,
    isAllNetworks,
    walletId,
  ]);

  const handleReceivePress = useCallback(async () => {
    if (isBotWalletReceiveBlocked) {
      showBotWalletDisabledToast('receive');
      return;
    }
    if (
      await backgroundApiProxy.serviceAccount.checkIsWalletNotBackedUp({
        walletId: wallet?.id ?? '',
      })
    ) {
      return;
    }
    defaultLogger.wallet.walletActions.actionReceive({
      walletType: wallet?.type ?? '',
      networkId: tokenInfo.networkId ?? '',
      source: 'tokenDetails',
      isSoftwareWalletOnlyUser,
    });
    navigation.pushModal(EModalRoutes.ReceiveModal, {
      screen: EModalReceiveRoutes.ReceiveSelectAggregateToken,
      params: {
        accountId,
        indexedAccountId,
        aggregateToken: tokenInfo,
        aggregateSubTokenList: tokens,
        enableNetworkAfterSelect: true,
        closeAfterSelect: false,
        onSelect: async (token: IAccountToken) => {
          if (networkUtils.isLightningNetworkByNetworkId(token.networkId)) {
            navigation.push(EModalReceiveRoutes.CreateInvoice, {
              networkId: token.networkId ?? '',
              accountId: token.accountId ?? '',
            });
            return;
          }

          const vaultSettings =
            await backgroundApiProxy.serviceNetwork.getVaultSettings({
              networkId: token.networkId ?? '',
            });

          // Merge-derive networks route through the derive-type selector,
          // which requires an empty accountId.
          const useDeriveSelector =
            vaultSettings.mergeDeriveAssetsEnabled &&
            isAllNetworks &&
            !accountUtils.isOthersWallet({ walletId });

          // The overview only holds the owned members; the QR page fills the
          // global members (create-address rows) from the synced config.
          navigation.push(EModalReceiveRoutes.ReceiveToken, {
            networkId: token.networkId ?? '',
            accountId: useDeriveSelector ? '' : (token.accountId ?? ''),
            walletId,
            token,
            indexedAccountId,
            // The switch exists only under All Networks (the overview tab
            // itself only renders there).
            switchEntry: isAllNetworks ? 'token' : undefined,
            allowAddressTypeMenu: true,
            source: 'tokenDetails',
            isAllNetworksMode: isAllNetworks,
            aggregateToken: tokenInfo,
            aggregateSubTokenList: tokens,
          });
        },
      },
    });
  }, [
    isBotWalletReceiveBlocked,
    wallet?.id,
    wallet?.type,
    isSoftwareWalletOnlyUser,
    navigation,
    accountId,
    indexedAccountId,
    tokenInfo,
    tokens,
    isAllNetworks,
    walletId,
  ]);

  // Rows are sorted by fiat value, so use the first tradable member. The
  // member's scaled-UI multiplier (detail level first, token level fallback)
  // rides along so the swap gate below and `pushSwapFromTokenDetails`'s
  // fail-closed re-check judge the same member.
  const swapMember = useMemo(() => {
    const row = rows.find(
      ({ token }) =>
        !isSwapEntryDisabledToken({
          contractAddress: token.address,
          isNative: token.isNative,
          networkId: token.networkId,
        }),
    );
    if (!row) {
      return undefined;
    }
    return {
      token: row.token,
      balanceMultiplier:
        tokenRebaseUtils.pickBalanceMultiplier(row.tokenDetail) ??
        row.token.balanceMultiplier,
    };
  }, [rows]);

  const handleSwapPress = useCallback(async () => {
    const member = swapMember?.token;
    if (!member?.networkId) {
      return;
    }
    const [memberNetwork, memberDeriveType] = await Promise.all([
      backgroundApiProxy.serviceNetwork.getNetworkSafe({
        networkId: member.networkId,
      }),
      backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: member.networkId,
      }),
    ]);
    pushSwapFromTokenDetails({
      navigation,
      token: {
        address: member.address,
        symbol: member.symbol,
        isNative: member.isNative,
        decimals: member.decimals,
        name: member.name,
        logoURI: member.logoURI ?? tokenInfo.logoURI,
        balanceMultiplier: swapMember?.balanceMultiplier,
      },
      networkId: member.networkId,
      networkLogoURI: memberNetwork?.logoURI,
      deriveType: memberDeriveType,
      walletType: wallet?.type,
      isSoftwareWalletOnlyUser,
    });
  }, [
    swapMember,
    tokenInfo.logoURI,
    wallet?.type,
    isSoftwareWalletOnlyUser,
    navigation,
  ]);

  const disableSwapAction = useMemo(
    () =>
      accountUtils.isUrlAccountFn({ accountId }) ||
      !swapMember ||
      // Scaled-UI member: same fail-closed swap gate as the single-network
      // header — Swap would display/build on the raw basis, out of sync with
      // the wallet display. A multiplier of exactly 1 is a no-op and must
      // not block.
      tokenRebaseUtils.isScalingBalanceMultiplier(
        swapMember?.balanceMultiplier,
      ),
    [accountId, swapMember],
  );

  const disableBuyAction = isWatchOnly && !platformEnv.isDev;

  const handleBuyPress = useCallback(() => {
    navigation.pushModal(EModalRoutes.AssetSelectorModal, {
      screen: EAssetSelectorRoutes.AggregateTokenSelector,
      params: {
        accountId,
        indexedAccountId,
        aggregateToken: tokenInfo,
        aggregateSubTokenList: tokens,
        enableNetworkAfterSelect: true,
        closeAfterSelect: false,
        onSelect: async (token: IAccountToken) => {
          // The chain-tab Buy button disables itself via this same check; the
          // selector cannot know support upfront, so gate after selection
          // instead of letting the widget request fail with a generic error.
          const isBuySupported =
            await backgroundApiProxy.serviceFiatCrypto.isTokenSupported({
              networkId: token.networkId ?? '',
              tokenAddress: token.address,
              type: 'buy',
            });
          if (!isBuySupported) {
            Toast.error({
              title: intl.formatMessage(
                {
                  id: ETranslations.wallet_history_settings_hide_risk_transaction_desc_unsupported,
                },
                { networkName: token.networkName || token.symbol },
              ),
            });
            return;
          }
          await openFiatCryptoWidget({
            type: 'buy',
            networkId: token.networkId ?? '',
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            accountId: token.accountId ?? '',
            walletId,
            walletType: wallet?.type,
            source: 'tokenDetails',
            isSoftwareWalletOnlyUser,
          });
        },
      },
    });
  }, [
    navigation,
    accountId,
    indexedAccountId,
    tokenInfo,
    tokens,
    intl,
    walletId,
    wallet?.type,
    isSoftwareWalletOnlyUser,
  ]);

  const renderPercent = useCallback(
    (tokenDetail?: { fiatValue?: string }) => {
      if (
        !tokenDetail ||
        !totalFiatValueBN ||
        totalFiatValueBN.lte(0) ||
        !isValidNumberValue(tokenDetail.fiatValue)
      ) {
        return null;
      }
      const percent = new BigNumber(tokenDetail.fiatValue)
        .div(totalFiatValueBN)
        .times(100);
      if (percent.isNaN() || percent.lt(0)) {
        return null;
      }
      return formatPortfolioPercent(
        percent.decimalPlaces(1).toNumber(),
        tokenDetail.fiatValue,
      );
    },
    [totalFiatValueBN],
  );

  const rowNetworkIds = useMemo(
    () =>
      Array.from(
        new Set(rows.map((row) => row.token.networkId).filter(Boolean)),
      ) as string[],
    [rows],
  );
  useEffect(() => {
    let active = true;
    void Promise.all(
      rowNetworkIds.map(async (networkId) => {
        try {
          const network = await backgroundApiProxy.serviceNetwork.getNetwork({
            networkId,
          });
          return network?.id === networkId ? network : undefined;
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
  }, [rowNetworkIds]);

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
    const byKey = new Map<string, IAccountToken>();
    const nativeRows: RowModel[] = [];
    const hidden = Boolean(settingsValue.hideValue);
    const targetCurrency = settings.currencyInfo?.id ?? '';
    for (const { token, tokenDetail } of rows) {
      const key = token.$key;
      if (
        typeof key === 'string' &&
        key &&
        key.length <= 256 &&
        !byKey.has(key)
      ) {
        byKey.set(key, token);
        const networkId = token.networkId ?? '';
        const network =
          fetchedNetworks[networkId] ??
          networkUtils.getLocalNetworkInfo(networkId);
        const logoURI =
          typeof network?.logoURI === 'string' &&
          network.logoURI.trim() &&
          network.logoURI.length <= 4096
            ? network.logoURI
            : undefined;
        const displayBalance = tokenDetail
          ? tokenRebaseUtils.applyBalanceMultiplier({
              amount: tokenDetail.balanceParsed,
              balanceMultiplier:
                tokenRebaseUtils.pickBalanceMultiplier(tokenDetail),
            })
          : undefined;
        let balanceValue: ReturnType<typeof formatOverviewAmount> | undefined;
        if (tokenDetail) {
          balanceValue = hidden
            ? { text: '****' }
            : formatOverviewAmount(
                String(displayOrUnavailable(displayBalance)),
                'balance',
              );
        }
        const rawFiat = tokenDetail
          ? displayFiatValueOrUnavailable(tokenDetail.fiatValue, displayBalance)
          : '';
        const fiatValue =
          rawFiat && rawFiat !== '-'
            ? convertFiat({
                value: rawFiat,
                sourceCurrency: tokenDetail?.currency ?? targetCurrency,
                targetCurrency,
                currencyMap,
              })
            : rawFiat;
        const unit =
          currencyMap[targetCurrency]?.unit ??
          currencyMap[tokenDetail?.currency ?? '']?.unit;
        let value: ReturnType<typeof formatOverviewAmount> | undefined;
        if (tokenDetail) {
          value = hidden
            ? { text: '****' }
            : formatOverviewAmount(String(fiatValue), 'value', unit);
        }
        let leading: Extract<RowModel, { type: 'identity' }>['leading'];
        if (
          networkUtils.isAllNetwork({ networkId }) ||
          networkUtils.isAggregateNetwork({ networkId })
        ) {
          leading = {
            kind: 'icon',
            name: 'AllNetworksSolid',
            tintColor: colors.iconActive.val,
          };
        } else if (network?.isCustomNetwork) {
          leading = {
            kind: 'network',
            fallbackText: network.name?.[0]?.toUpperCase(),
            backgroundColor: colors.bgInverse.val,
          };
        } else {
          leading = {
            kind: 'network',
            image: logoURI
              ? { uri: logoURI, width: 32, height: 32 }
              : undefined,
            fallbackIcon: {
              name: 'GlobusOutline',
              tintColor: colors.iconSubdued.val,
            },
            backgroundColor: colors.bgApp.val,
          };
        }
        const chevronAccessory = platformEnv.isNative
          ? ({ kind: 'chevron' } as const)
          : ({
              kind: 'icon',
              name: 'ChevronRightSmallOutline',
              tintColor: colors.iconSubdued.val,
            } as const);
        nativeRows.push({
          key,
          type: 'identity',
          height: tokenDetail ? 60 : 48,
          leading,
          title: String(token.networkName || token.networkId || ''),
          subtitle: renderPercent(tokenDetail) ?? undefined,
          trailing: tokenDetail
            ? [
                {
                  kind: 'valuePair',
                  primary: balanceValue?.text ?? '',
                  secondary: value?.text ?? '',
                  primaryTextSegments: balanceValue?.segments,
                  secondaryTextSegments: value?.segments,
                },
                chevronAccessory,
              ]
            : [
                {
                  kind: 'icon',
                  name: 'RefreshCcwOutline',
                  tintColor: colors.iconSubdued.val,
                  hoverActionKey: platformEnv.isNative
                    ? undefined
                    : 'missing-detail',
                },
                chevronAccessory,
              ],
          style: {
            container: { cornerRadius: 12 },
            horizontalPadding: 12,
            verticalPadding: 8,
            leadingGap: 12,
            trailingGap: 12,
            image: { width: 32, height: 32, shape: 'circle' },
            title: {
              fontSize: 16,
              lineHeight: 24,
              fontWeight: 'medium',
              color: colors.text.val,
            },
            subtitle: {
              fontSize: 14,
              lineHeight: 20,
              color: colors.textSubdued.val,
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
      rows: nativeRows,
    };
    return { snapshot: validateSnapshot(nextSnapshot), tokensByKey: byKey };
  }, [
    rows,
    settingsValue.hideValue,
    settings.currencyInfo?.id,
    currencyMap,
    colors,
    theme,
    renderPercent,
    fetchedNetworks,
  ]);

  const closeDetailTooltip = useCallback(() => {
    const token = activeTooltipToken.current;
    activeTooltipToken.current = undefined;
    if (token) listRef.current?.setActionAnchorState({ token, open: false });
    setDetailTooltip(undefined);
  }, []);
  useEffect(() => {
    closeDetailTooltip();
  }, [closeDetailTooltip, snapshot]);
  useEffect(
    () => () => {
      const token = activeTooltipToken.current;
      if (token) listRef.current?.setActionAnchorState({ token, open: false });
    },
    [],
  );
  const handleRowAction = useCallback(
    (event: RowActionEvent) => {
      const token = tokensByKey.get(event.rowKey ?? '');
      if (!token) return;
      if (event.actionKey === 'press') {
        onSelectToken(token);
      } else if (
        event.actionKey === 'missing-detail' &&
        !platformEnv.isNative &&
        event.anchor &&
        rows.some((row) => row.token.$key === token.$key && !row.tokenDetail)
      ) {
        const anchor = event.anchor;
        closeDetailTooltip();
        activeTooltipToken.current = anchor.token;
        listRef.current?.setActionAnchorState({
          token: anchor.token,
          open: true,
        });
        containerRef.current?.measureInWindow((x, y) => {
          if (activeTooltipToken.current !== anchor.token) return;
          setDetailTooltip({
            anchor,
            left: anchor.windowRect.x - x,
            top: anchor.windowRect.y - y,
          });
        });
      }
    },
    [tokensByKey, onSelectToken, rows, closeDetailTooltip],
  );

  const listHeader = (
    <Stack mx="$-2">
      {isWatchOnly ? (
        <Stack pt="$5" px="$5">
          <Alert
            type="warning"
            icon="ErrorOutline"
            title={intl.formatMessage({
              id: ETranslations.watch_only_alert_do_not_send,
            })}
          />
        </Stack>
      ) : null}
      <Stack px="$5" py="$5">
        {/* Aggregate balance */}
        <TokenDetailsBalanceHero
          isLoading={showLoadingState}
          currency={currency}
          fiatValue={totalFiatValue}
          balanceParsed={totalBalanceParsed}
        />
        {/* Actions */}
        <RawActions>
          <RawActions.Send
            onPress={handleSendPress}
            trackID="wallet-token-details-overview-send"
          />
          <RawActions.Receive
            disabled={isWatchOnly || isBotWalletReceiveBlocked}
            allowPressWhenDisabled={isBotWalletReceiveBlocked}
            onPress={handleReceivePress}
            trackID="wallet-token-details-overview-receive"
          />
          <RawActions.Swap
            onPress={handleSwapPress}
            disabled={disableSwapAction}
            trackID="wallet-token-details-overview-swap"
          />
          <ReviewControl>
            <RawActions.Buy
              label={intl.formatMessage({ id: ETranslations.global_buy })}
              disabled={disableBuyAction}
              onPress={handleBuyPress}
              trackID="wallet-token-details-overview-buy"
            />
          </ReviewControl>
        </RawActions>
      </Stack>
      {/* Earn entry across all member networks */}
      <TokenDetailsDeFiBlock
        networkId={tokenInfo.networkId ?? ''}
        tokenAddress={tokenInfo.$key}
        walletType={wallet?.type}
        tokenLogoURI={tokenInfo.logoURI}
        aggregateTokens={earnMembers}
      />
      <SizableText px="$5" pb="$1" size="$headingSm" color="$textSubdued">
        {intl.formatMessage({ id: ETranslations.global_asset_allocation })}
      </SizableText>
    </Stack>
  );
  const webScrollHost = !platformEnv.isNative
    ? (pagerPage.isFocused && isRouteFocused && pagerPage.owner) || null
    : undefined;
  const list = (
    <Stack ref={containerRef} flex={1} minHeight={0} position="relative">
      <NativeList
        ref={listRef}
        style={{ flex: 1 }}
        snapshot={snapshot}
        listHeader={listHeader}
        listFooter={<Stack height={20} />}
        webScrollHost={webScrollHost}
        keyboardShouldPersistTaps="handled"
        onRowAction={handleRowAction}
        onActionAnchorInvalidated={(event) => {
          if (activeTooltipToken.current === event.token) closeDetailTooltip();
        }}
      />
      {detailTooltip ? (
        <Stack
          position="absolute"
          left={detailTooltip.left}
          top={detailTooltip.top}
          width={detailTooltip.anchor.windowRect.width}
          height={detailTooltip.anchor.windowRect.height}
          pointerEvents="box-none"
        >
          <LazyTooltip
            open
            triggerAsChild
            placement="top"
            offset={12}
            onOpenChange={(open) => {
              if (!open) closeDetailTooltip();
            }}
            renderTrigger={
              <Stack
                width={detailTooltip.anchor.windowRect.width}
                height={detailTooltip.anchor.windowRect.height}
                pointerEvents="none"
              />
            }
            renderContent={intl.formatMessage({
              id: ETranslations.network_enable_or_create_address,
            })}
          />
        </Stack>
      ) : null}
    </Stack>
  );
  return platformEnv.isNative ? (
    list
  ) : (
    <AppPagerContent>{list}</AppPagerContent>
  );
}

export default memo(TokenDetailsOverview);

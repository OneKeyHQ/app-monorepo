import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import {
  Alert,
  Button,
  DashText,
  Divider,
  Icon,
  IconButton,
  KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET,
  Keyboard,
  NumberSizeableText,
  Popover,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
  usePopoverContext,
  useScrollContentTabBarOffset,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AmountInput } from '@onekeyhq/kit/src/components/AmountInput';
import { LightweightChart } from '@onekeyhq/kit/src/components/LightweightChart';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useNetworkLogoUri } from '@onekeyhq/kit/src/hooks/useNetworkLogoUri';
import { usePerpTabConfig } from '@onekeyhq/kit/src/hooks/usePerpTabConfig';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useSwapFromTokenAmountAtom,
  useSwapSelectTokenDetailFetchingAtom,
  useSwapSelectedFromTokenBalanceAtom,
  useSwapToTokenAmountAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap';
import { validateAmountInput } from '@onekeyhq/kit/src/utils/validateAmountInput';
import { BaseMarketTokenPrice } from '@onekeyhq/kit/src/views/Market/components/MarketTokenPrice';
import {
  StockIsOpenBadge,
  StockSourceLogo,
} from '@onekeyhq/kit/src/views/Market/components/PerpsBadges';
import { PriceChangePercentage } from '@onekeyhq/kit/src/views/Market/components/PriceChangePercentage';
import { isOndoStockSource } from '@onekeyhq/kit/src/views/Market/components/utils/stockSource';
import { usePerpsNavigation } from '@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation';
import { TokenList } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/components/TokenInputSection/TokenList';
import type { IToken } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/SwapPanel/types';
import { MarketTokenSelector } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelector';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks/useTokenDetail';
import {
  formatCurrencyStatValue,
  formatMarketCapValue,
  formatPercentValue,
} from '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/statValue';
import { EModalMarketRoutes } from '@onekeyhq/kit/src/views/Market/router';
import type { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { presetNetworksMap } from '@onekeyhq/shared/src/config/presetNetworks';
import { dismissKeyboard } from '@onekeyhq/shared/src/keyboard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EPerpPageEnterSource } from '@onekeyhq/shared/src/logger/scopes/perp/perpPageSource';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSwapParamList } from '@onekeyhq/shared/src/routes/swap';
import { EModalSwapRoutes } from '@onekeyhq/shared/src/routes/swap';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import {
  EProtocolOfExchange,
  type ESwapDirectionType,
  type IFetchQuoteResult,
  type IMarketPresetTokenContext,
  type ISwapAlertState,
  type ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockChannelAsyncStatus,
  ESwapStockChannelStage,
  ESwapStockTradeSide,
  type IUseSwapStockChannelReturn,
} from '../../hooks/useSwapStockChannel';
import { SwapTestIDs } from '../../testIDs';

import SwapActionsState from './SwapActionsState';
import SwapAlertContainer from './SwapAlertContainer';
import SwapQuoteResult from './SwapQuoteResult';
import {
  SwapStockTradeProvider,
  useSwapStockTradeContext,
} from './SwapStockTradeProvider';

import type { KeyboardAwareScrollViewRef } from 'react-native-keyboard-controller';

interface ISwapStockDesktopContainerProps {
  headerContent?: ReactNode;
  marketPresetToken?: IMarketPresetTokenContext;
  storeName: EJotaiContextStoreNames;
  onSelectToken: (type: ESwapDirectionType) => void;
  fetchLoading: boolean;
  onSelectPercentageStage: (stage: number) => void;
  onBalanceMaxPress: () => void;
  onPreSwap: () => void;
  onToAnotherAddressModal: () => void;
  onOpenProviderList: () => void;
  refreshAction: () => void;
  quoteResult?: IFetchQuoteResult;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  alerts: {
    states: ISwapAlertState[];
    quoteId: string;
  };
}

type IStockChartRange = '1D' | '1W' | '1M' | '1Y';

const STOCK_CHART_RANGE_ITEMS: {
  label: IStockChartRange;
  interval: string;
  seconds: number;
}[] = [
  { label: '1D', interval: '1m', seconds: 24 * 60 * 60 },
  { label: '1W', interval: '1H', seconds: 7 * 24 * 60 * 60 },
  { label: '1M', interval: '4H', seconds: 30 * 24 * 60 * 60 },
  { label: '1Y', interval: '1D', seconds: 365 * 24 * 60 * 60 },
];

function normalizeStockChartData(points?: { t: number; c: number }[]) {
  const pointsByTime = new Map<number, number>();
  for (const point of points ?? []) {
    if (Number.isFinite(point.t) && Number.isFinite(point.c)) {
      pointsByTime.set(point.t, point.c);
    }
  }
  return Array.from(pointsByTime.entries())
    .toSorted((a, b) => a[0] - b[0])
    .map(([time, price]) => [time, price] as [number, number]);
}

function StockMarketDataItem({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <YStack
      flexGrow={1}
      flexBasis={0}
      minWidth={0}
      h={48}
      px="$3.5"
      py="$1.5"
      borderRadius="$3"
      bg="$bgSubdued"
      justifyContent="space-between"
    >
      <XStack alignItems="center" gap="$1" minWidth={0} h="$4">
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          numberOfLines={1}
          flexShrink={1}
        >
          {label}
        </SizableText>
        {tooltip ? (
          <Popover.Tooltip
            iconSize="$4"
            title={label}
            tooltip={tooltip}
            placement="top"
          />
        ) : null}
      </XStack>
      <SizableText size="$bodyMd" color="$text" numberOfLines={1}>
        {value}
      </SizableText>
    </YStack>
  );
}

function StockMarketDataGrid() {
  const intl = useIntl();
  const { tokenDetail } = useTokenDetail();
  const assetAnalysis = tokenDetail?.stock?.assetAnalysis;
  const rows = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_24h_volume,
        }),
        value: formatCurrencyStatValue(
          assetAnalysis?.volume24h ?? tokenDetail?.volume24h,
        ),
        tooltip: 'Total trading value over the past 24 hours.',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_volume_shares,
        }),
        value: formatMarketCapValue(assetAnalysis?.volumeShares),
        tooltip: 'Total underlying shares traded over the past 24 hours.',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_turnover_rate,
        }),
        value: formatPercentValue(assetAnalysis?.turnoverRate),
        tooltip:
          'Share turnover over the past 24 hours, calculated from trading volume and shares outstanding.',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_1y_avg_daily_vol,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.avgDailyVolume1y),
        tooltip: 'Average daily trading value over the past year.',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_high,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.weekHigh52),
        tooltip: 'Highest traded price over the past 52 weeks.',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.dexmarket_stock_52_week_low,
        }),
        value: formatCurrencyStatValue(assetAnalysis?.weekLow52),
        tooltip: 'Lowest traded price over the past 52 weeks.',
      },
    ],
    [assetAnalysis, intl, tokenDetail?.volume24h],
  );

  return (
    <YStack w="100%" gap="$3" testID={SwapTestIDs.stockMarketDataGrid}>
      <SizableText size="$bodyMdMedium" color="$text">
        Market data
      </SizableText>
      <YStack w="100%" gap="$3">
        {[0, 2, 4].map((rowStart) => (
          <XStack key={rowStart} gap="$3" w="100%" alignItems="stretch">
            {rows.slice(rowStart, rowStart + 2).map((item) => (
              <StockMarketDataItem
                key={item.label}
                label={item.label}
                value={item.value}
                tooltip={item.tooltip}
              />
            ))}
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}

function StockTradeSideSwitch({
  value,
  onChange,
}: {
  value: ESwapStockTradeSide;
  onChange: (value: ESwapStockTradeSide) => void;
}) {
  const intl = useIntl();
  const isBuyActive = value === ESwapStockTradeSide.Buy;
  const isSellActive = value === ESwapStockTradeSide.Sell;
  return (
    <XStack
      w={141}
      h={36}
      p="$0.5"
      borderRadius="$3"
      bg="$bgStrong"
      overflow="hidden"
    >
      <YStack
        testID={SwapTestIDs.stockBuyTab}
        flex={1}
        alignItems="center"
        justifyContent="center"
        borderRadius="$2.5"
        bg={isBuyActive ? '$bgSuccessStrong' : '$transparent'}
        userSelect="none"
        onPress={() => onChange(ESwapStockTradeSide.Buy)}
      >
        <SizableText
          size="$bodyMdMedium"
          color={isBuyActive ? '$textOnColor' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_buy })}
        </SizableText>
      </YStack>
      <YStack
        testID={SwapTestIDs.stockSellTab}
        flex={1}
        alignItems="center"
        justifyContent="center"
        borderRadius="$2.5"
        bg={isSellActive ? '$bgCriticalStrong' : '$transparent'}
        userSelect="none"
        onPress={() => onChange(ESwapStockTradeSide.Sell)}
      >
        <SizableText
          size="$bodyMdMedium"
          color={isSellActive ? '$textOnColor' : '$textSubdued'}
        >
          {intl.formatMessage({ id: ETranslations.global_sell })}
        </SizableText>
      </YStack>
    </XStack>
  );
}

function StockEstimatedReceive({
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  stockChannel,
}: {
  quoteResult?: IFetchQuoteResult;
  quoteLoading: boolean;
  quoteEventFetching: boolean;
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const intl = useIntl();
  const [toTokenAmount, setToTokenAmount] = useSwapToTokenAmountAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const receiveToken =
    stockChannel.tradeSide === ESwapStockTradeSide.Buy
      ? stockChannel.currentStockToken
      : stockChannel.payToken;
  const receiveAmount = quoteResult?.toAmount ?? toTokenAmount.value;
  const isLoading = quoteLoading || quoteEventFetching;
  const receiveFiatValue = useMemo(() => {
    const amountBN = new BigNumber(receiveAmount ?? 0);
    const priceBN = new BigNumber(receiveToken?.price ?? 0);
    const fiatBN = amountBN.multipliedBy(priceBN);
    if (fiatBN.isNaN() || fiatBN.isZero()) {
      return '';
    }
    return fiatBN.toFixed();
  }, [receiveAmount, receiveToken?.price]);
  useEffect(() => {
    const quoteToAmount = quoteResult?.toAmount;
    if (
      !quoteToAmount ||
      (toTokenAmount.value === quoteToAmount && !toTokenAmount.isInput)
    ) {
      return;
    }
    setToTokenAmount({ value: quoteToAmount, isInput: false });
  }, [
    quoteResult?.toAmount,
    setToTokenAmount,
    toTokenAmount.isInput,
    toTokenAmount.value,
  ]);

  return (
    <XStack
      testID={SwapTestIDs.stockEstimatedReceive}
      h={48}
      alignItems="center"
      justifyContent="space-between"
      gap="$2"
    >
      <XStack alignItems="center" gap="$1" flexShrink={0} h="$5">
        <Icon name="HandCoinsOutline" size="$4.5" color="$iconSubdued" />
        <DashText
          size="$bodyMd"
          color="$text"
          dashColor="$borderStrong"
          dashThickness={0.5}
        >
          {intl.formatMessage({
            id: ETranslations.private_send_estimated_received,
          })}
        </DashText>
      </XStack>
      <YStack flex={1} maxWidth={246} alignItems="flex-end" minWidth={0}>
        {isLoading ? (
          <>
            <Skeleton h="$4" w="$20" />
            <Skeleton mt="$1" h="$4" w="$16" />
          </>
        ) : (
          <>
            <SizableText
              size="$bodyMdMedium"
              color="$text"
              numberOfLines={1}
              textAlign="right"
              maxWidth="100%"
            >
              {receiveAmount && receiveToken?.symbol ? (
                <>
                  <NumberSizeableText size="$bodyMdMedium" formatter="balance">
                    {receiveAmount}
                  </NumberSizeableText>
                  {` ${receiveToken.symbol}`}
                </>
              ) : (
                '--'
              )}
            </SizableText>
            <NumberSizeableText
              size="$bodyMd"
              color="$textSubdued"
              formatter="value"
              formatterOptions={{
                currency: settingsPersistAtom.currencyInfo.symbol,
              }}
            >
              {receiveFiatValue || '0'}
            </NumberSizeableText>
          </>
        )}
      </YStack>
    </XStack>
  );
}

function StockTradeStatusAlert({
  stockChannel,
}: {
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const intl = useIntl();
  const { perpsInfo } = useTokenDetail();
  const { perpDisabled } = usePerpTabConfig();
  const { navigateToPerps } = usePerpsNavigation(
    EPerpPageEnterSource.MarketList,
  );
  const perpsTicker = perpsInfo?.hlTicker;
  const onOpenPerps = useCallback(() => {
    if (perpDisabled || !perpsTicker) {
      return;
    }
    navigateToPerps(perpsTicker);
  }, [navigateToPerps, perpDisabled, perpsTicker]);

  if (stockChannel.channelStage === ESwapStockChannelStage.MarketClosed) {
    const reason = stockChannel.stockMarketStatus?.reason;
    return (
      <Alert
        testID={SwapTestIDs.stockTradeStatusAlert}
        type="warning"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.dexmarket_stock_status_closed_error,
        })}
        description={
          reason ??
          intl.formatMessage({
            id: ETranslations.dexmarket_stock_status_tooltip,
          })
        }
        action={
          perpsTicker && !perpDisabled
            ? {
                primary: intl.formatMessage({
                  id: ETranslations.global_perp,
                }),
                primaryVariant: 'secondary',
                onPrimaryPress: onOpenPerps,
              }
            : undefined
        }
      />
    );
  }

  if (stockChannel.channelStage === ESwapStockChannelStage.MarketUnavailable) {
    return (
      <Alert
        testID={SwapTestIDs.stockTradeStatusAlert}
        type="warning"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        })}
        description={
          stockChannel.stockMarketStatus?.reason ??
          intl.formatMessage({
            id: ETranslations.dexmarket_stock_status_tooltip,
          })
        }
        action={
          perpsTicker && !perpDisabled
            ? {
                primary: intl.formatMessage({
                  id: ETranslations.global_perp,
                }),
                primaryVariant: 'secondary',
                onPrimaryPress: onOpenPerps,
              }
            : undefined
        }
      />
    );
  }

  if (stockChannel.channelStage === ESwapStockChannelStage.MissingPayToken) {
    return (
      <Alert
        testID={SwapTestIDs.stockTradeStatusAlert}
        type="warning"
        icon="InfoCircleOutline"
        title={intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        })}
      />
    );
  }

  return null;
}

function StockActionGate({
  stockChannel,
  onPreSwap,
  onToAnotherAddressModal,
  onSelectPercentageStage,
}: {
  stockChannel: IUseSwapStockChannelReturn;
  onPreSwap: () => void;
  onToAnotherAddressModal: () => void;
  onSelectPercentageStage: (stage: number) => void;
}) {
  const intl = useIntl();
  const disabledLabel = useMemo(() => {
    switch (stockChannel.channelStage) {
      case ESwapStockChannelStage.InitializingStock:
      case ESwapStockChannelStage.CheckingMarketStatus:
      case ESwapStockChannelStage.InitializingPayToken:
        return intl.formatMessage({
          id: ETranslations.swap_page_button_fetching_quotes,
        });
      case ESwapStockChannelStage.MissingStock:
        return intl.formatMessage({
          id: ETranslations.swap_page_button_select_token,
        });
      case ESwapStockChannelStage.MissingPayToken:
      case ESwapStockChannelStage.MarketUnavailable:
        return intl.formatMessage({
          id: ETranslations.swap_page_alert_no_provider_supports_trade,
        });
      case ESwapStockChannelStage.MarketClosed:
        return intl.formatMessage({
          id: ETranslations.dexmarket_stock_status_closed_error,
        });
      default:
        return intl.formatMessage({
          id: ETranslations.swap_page_button_enter_amount,
        });
    }
  }, [intl, stockChannel.channelStage]);

  if (stockChannel.readyForQuote) {
    return (
      <SwapActionsState
        onPreSwap={onPreSwap}
        onOpenRecipientAddress={onToAnotherAddressModal}
        onSelectPercentageStage={onSelectPercentageStage}
      />
    );
  }

  return (
    <Button
      testID={SwapTestIDs.swapButton}
      size="large"
      variant="primary"
      disabled
      borderRadius="$full"
    >
      {disabledLabel}
    </Button>
  );
}

function getNetworkLogoURI(networkId?: string) {
  if (!networkId) {
    return undefined;
  }
  return Object.values(presetNetworksMap).find(
    (network) => network.id === networkId,
  )?.logoURI;
}

function getStockInputTokenIdentityKey(token?: Partial<ISwapToken>) {
  if (!token?.networkId) {
    return '';
  }
  return `${token.networkId}:${token.contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

function getStockInputTokenPrice(token?: ISwapToken) {
  if (token?.price) {
    return token.price;
  }
  const balanceBN = new BigNumber(token?.balanceParsed ?? 0);
  const fiatValueBN = new BigNumber(token?.fiatValue ?? 0);
  if (
    balanceBN.isNaN() ||
    balanceBN.isZero() ||
    fiatValueBN.isNaN() ||
    fiatValueBN.isZero()
  ) {
    return undefined;
  }
  return fiatValueBN.dividedBy(balanceBN).toFixed();
}

function useStockInputTokenBalance({
  enabled,
  token,
}: {
  enabled: boolean;
  token?: ISwapToken;
}) {
  const { activeAccount } = useActiveAccount({ num: 0 });
  const tokenScope = getStockInputTokenIdentityKey(token);
  const hasActiveAccount = Boolean(
    activeAccount?.indexedAccount?.id || activeAccount?.account?.id,
  );
  const shouldFetchNetworkAccount = Boolean(
    enabled && token?.networkId && hasActiveAccount,
  );
  const networkAccountScope = `${shouldFetchNetworkAccount ? '1' : '0'}:${
    token?.networkId ?? ''
  }:${activeAccount?.indexedAccount?.id ?? ''}:${
    activeAccount?.account?.id ?? ''
  }`;
  const { result: networkAccountState, isLoading: networkAccountLoading } =
    usePromiseResult(
      async () => {
        if (!shouldFetchNetworkAccount || !token?.networkId) {
          return {
            scope: networkAccountScope,
            account: null,
          };
        }
        const defaultDeriveType =
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: token.networkId,
          });
        const account =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            accountId: activeAccount?.indexedAccount?.id
              ? undefined
              : activeAccount?.account?.id,
            indexedAccountId: activeAccount?.indexedAccount?.id ?? '',
            networkId: token.networkId,
            deriveType: defaultDeriveType ?? 'default',
          });
        return {
          scope: networkAccountScope,
          account,
        };
      },
      [
        activeAccount?.account?.id,
        activeAccount?.indexedAccount?.id,
        networkAccountScope,
        shouldFetchNetworkAccount,
        token?.networkId,
      ],
      {
        initResult: {
          scope: '',
          account: null,
        },
        watchLoading: shouldFetchNetworkAccount,
      },
    );
  const networkAccountReady = networkAccountState.scope === networkAccountScope;
  const networkAccount = networkAccountReady
    ? networkAccountState.account
    : null;
  const balanceScope = `${tokenScope}:${networkAccountReady ? 'ready' : 'pending'}:${
    networkAccount?.id ?? ''
  }:${networkAccount?.address ?? ''}`;
  const shouldWaitForNetworkAccount =
    shouldFetchNetworkAccount && !networkAccountReady;
  const { result: detailState, isLoading: detailLoading } = usePromiseResult(
    async () => {
      if (!enabled || !token || shouldWaitForNetworkAccount) {
        return {
          scope: balanceScope,
          balance: undefined as string | undefined,
          tokenDetail: undefined as ISwapToken | undefined,
        };
      }
      if (!networkAccount) {
        return {
          scope: balanceScope,
          balance: token.balanceParsed ?? '0',
          tokenDetail: token,
        };
      }
      const details =
        await backgroundApiProxy.serviceSwap.fetchSwapTokenDetails({
          networkId: token.networkId,
          contractAddress: token.contractAddress,
          accountId: networkAccount.id,
          accountAddress: networkAccount.address,
          currency: 'usd',
        });
      return {
        scope: balanceScope,
        balance: details?.[0]?.balanceParsed ?? token.balanceParsed ?? '0',
        tokenDetail: details?.[0],
      };
    },
    [balanceScope, enabled, networkAccount, shouldWaitForNetworkAccount, token],
    {
      initResult: {
        scope: '',
        balance: undefined as string | undefined,
        tokenDetail: undefined as ISwapToken | undefined,
      },
      watchLoading: enabled,
    },
  );

  const balanceReady =
    detailState.scope === balanceScope && detailState.balance !== undefined;

  return {
    balance: balanceReady ? detailState.balance : undefined,
    tokenDetail: balanceReady ? detailState.tokenDetail : undefined,
    loading:
      enabled &&
      Boolean(
        token &&
        (!balanceReady ||
          networkAccountLoading ||
          shouldWaitForNetworkAccount ||
          detailLoading),
      ),
  };
}

function StockPayTokenPopoverContent({
  tokens,
  currentSelectToken,
  disableNativeToken,
  onTokenPress,
}: {
  tokens: IToken[];
  currentSelectToken?: ISwapToken;
  disableNativeToken?: boolean;
  onTokenPress: (token: IToken) => void;
}) {
  const { closePopover } = usePopoverContext();
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.swap,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <TokenList
        currentSelectToken={currentSelectToken}
        tokens={tokens}
        onTokenPress={(token) => {
          onTokenPress(token);
          void closePopover?.();
        }}
        onTradePress={() => {
          void closePopover?.();
        }}
        disabledOnSwitchToTrade
        disableNativeToken={disableNativeToken}
      />
    </AccountSelectorProviderMirror>
  );
}

function StockAmountInputSkeleton({ isBuySide }: { isBuySide: boolean }) {
  const intl = useIntl();
  return (
    <YStack h={124} bg="$bgSubdued" borderRadius="$4" overflow="hidden">
      <SizableText pt="$3.5" px="$3.5" size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: isBuySide ? ETranslations.global_pay : ETranslations.global_sell,
        })}
      </SizableText>
      <XStack flex={1} alignItems="center" justifyContent="space-between">
        <YStack px="$3.5" gap="$3">
          <Skeleton h="$8" w="$24" />
          <Skeleton h="$4" w="$16" />
        </YStack>
        <YStack px="$3.5" alignItems="flex-end" gap="$3">
          <Skeleton h="$8" w="$28" />
          <Skeleton h="$4" w="$24" />
        </YStack>
      </XStack>
    </YStack>
  );
}

function StockAmountInput({
  fetchLoading,
  onBalanceMaxPress,
  stockChannel,
}: Pick<
  ISwapStockDesktopContainerProps,
  'fetchLoading' | 'onBalanceMaxPress'
> & {
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const intl = useIntl();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [fromTokenBalance, setFromTokenBalance] =
    useSwapSelectedFromTokenBalanceAtom();
  const [swapTokenDetailLoading] = useSwapSelectTokenDetailFetchingAtom();
  const [settingsPersistAtom] = useSettingsPersistAtom();
  const {
    currentStockToken,
    payToken,
    payTokens,
    selectablePayTokens,
    payTokenOptionsLoading,
    disableNativePayToken,
    marketStatusStatus,
    selectPayToken,
    speedConfigReady,
    stockTokenStatus,
    tradeSide,
  } = stockChannel;
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  const inputToken = isBuySide ? payToken : currentStockToken;
  const stockIdentityReady =
    stockTokenStatus === ESwapStockChannelAsyncStatus.Ready &&
    marketStatusStatus === ESwapStockChannelAsyncStatus.Ready;
  const payTokenReady =
    !isBuySide ||
    Boolean(
      stockIdentityReady &&
      speedConfigReady &&
      payToken &&
      selectablePayTokens.some((token) =>
        equalTokenNoCaseSensitive({ token1: token, token2: payToken }),
      ),
    );
  const inputTokenReady = isBuySide
    ? payTokenReady
    : stockIdentityReady && Boolean(inputToken);
  const stockInputTokenBalance = useStockInputTokenBalance({
    enabled: inputTokenReady,
    token: inputToken,
  });
  const inputTokenBalanceReady =
    inputTokenReady && !stockInputTokenBalance.loading;
  const resolvedInputTokenBalance = stockInputTokenBalance.balance ?? '0';
  const displayBalance = useMemo(() => {
    if (stockInputTokenBalance.balance !== undefined) {
      return stockInputTokenBalance.balance;
    }
    if (isBuySide && fromTokenBalance) {
      return fromTokenBalance;
    }
    return inputToken?.balanceParsed ?? '0';
  }, [
    fromTokenBalance,
    inputToken?.balanceParsed,
    isBuySide,
    stockInputTokenBalance.balance,
  ]);
  const inputTokenNetworkLogoURI =
    inputToken?.networkLogoURI ?? getNetworkLogoURI(inputToken?.networkId);
  const inputTokenPrice =
    getStockInputTokenPrice(stockInputTokenBalance.tokenDetail) ??
    getStockInputTokenPrice(inputToken);
  const amountFiatValue = useMemo(() => {
    const amountBN = new BigNumber(fromTokenAmount.value ?? 0);
    const priceBN = new BigNumber(inputTokenPrice ?? 0);
    const fiatBN = amountBN.multipliedBy(priceBN);
    if (fiatBN.isNaN() || fiatBN.isZero()) {
      return '';
    }
    return fiatBN.toFixed();
  }, [fromTokenAmount.value, inputTokenPrice]);

  useEffect(() => {
    if (!inputTokenReady || stockInputTokenBalance.loading) {
      return;
    }
    if (fromTokenBalance === resolvedInputTokenBalance) {
      return;
    }
    setFromTokenBalance(resolvedInputTokenBalance);
  }, [
    fromTokenBalance,
    inputTokenReady,
    resolvedInputTokenBalance,
    setFromTokenBalance,
    stockInputTokenBalance.loading,
  ]);
  useEffect(() => {
    const tokenDetail = stockInputTokenBalance.tokenDetail;
    if (
      !isBuySide ||
      !tokenDetail ||
      !payToken ||
      !equalTokenNoCaseSensitive({ token1: tokenDetail, token2: payToken })
    ) {
      return;
    }
    if (
      tokenDetail.price === payToken.price &&
      tokenDetail.fiatValue === payToken.fiatValue &&
      tokenDetail.balanceParsed === payToken.balanceParsed
    ) {
      return;
    }
    selectPayToken(tokenDetail as IToken, false);
  }, [isBuySide, payToken, selectPayToken, stockInputTokenBalance.tokenDetail]);

  if (!inputTokenReady || !inputTokenBalanceReady) {
    return <StockAmountInputSkeleton isBuySide={isBuySide} />;
  }

  return (
    <YStack h={124} bg="$bgSubdued" borderRadius="$4" overflow="hidden">
      <SizableText pt="$3.5" px="$3.5" size="$bodyMd" color="$textSubdued">
        {intl.formatMessage({
          id: isBuySide ? ETranslations.global_pay : ETranslations.global_sell,
        })}
      </SizableText>
      <AmountInput
        value={fromTokenAmount.value}
        onChange={(value) => {
          if (validateAmountInput(value, inputToken?.decimals)) {
            setFromTokenAmount({
              value,
              isInput: true,
            });
          }
        }}
        bg="$transparent"
        borderWidth={0}
        borderRadius="$0"
        flex={1}
        valueProps={{
          value: amountFiatValue,
          currency: settingsPersistAtom.currencyInfo.symbol,
        }}
        balanceProps={{
          value: inputToken ? displayBalance : undefined,
          loading:
            swapTokenDetailLoading.from || stockInputTokenBalance.loading,
          onPress: onBalanceMaxPress,
          hideIcon: true,
          tokenSymbol: inputToken?.symbol,
          testID: SwapTestIDs.maxButton,
        }}
        maxAmountText="Max"
        inputProps={{
          placeholder: '0.0',
          testID: SwapTestIDs.fromAmountInput,
        }}
        tokenSelectorTriggerProps={{
          testID: SwapTestIDs.fromTokenSelector,
          minWidth: 132,
          justifyContent: 'flex-end',
          loading: fetchLoading || (isBuySide && payTokenOptionsLoading),
          selectedTokenImageUri: inputToken?.logoURI,
          selectedNetworkImageUri: inputTokenNetworkLogoURI,
          selectedTokenSymbol: inputToken?.symbol,
          showNetworkIconBorder: false,
          disabled: !isBuySide || selectablePayTokens.length <= 1,
          popover:
            isBuySide && payTokens.length > 1
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.dexmarket_select_token,
                  }),
                  content: (
                    <StockPayTokenPopoverContent
                      tokens={payTokens}
                      currentSelectToken={payToken}
                      disableNativeToken={disableNativePayToken}
                      onTokenPress={selectPayToken}
                    />
                  ),
                }
              : undefined,
        }}
        enableMaxAmount
      />
    </YStack>
  );
}

function StockTradeTicket({
  fetchLoading,
  onSelectPercentageStage,
  onBalanceMaxPress,
  onPreSwap,
  onToAnotherAddressModal,
  onOpenProviderList,
  refreshAction,
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  alerts,
  stockChannel,
  tradeSide,
  onTradeSideChange,
  compact,
}: Omit<
  ISwapStockDesktopContainerProps,
  'headerContent' | 'marketPresetToken' | 'storeName'
> & {
  stockChannel: IUseSwapStockChannelReturn;
  tradeSide: ESwapStockTradeSide;
  onTradeSideChange: (value: ESwapStockTradeSide) => void;
  compact?: boolean;
}) {
  return (
    <YStack gap={compact ? '$3' : '$4'}>
      <StockTradeSideSwitch value={tradeSide} onChange={onTradeSideChange} />
      <StockAmountInput
        fetchLoading={fetchLoading}
        onBalanceMaxPress={onBalanceMaxPress}
        stockChannel={stockChannel}
      />
      <StockEstimatedReceive
        quoteResult={quoteResult}
        quoteLoading={quoteLoading}
        quoteEventFetching={quoteEventFetching}
        stockChannel={stockChannel}
      />
      <StockActionGate
        stockChannel={stockChannel}
        onPreSwap={onPreSwap}
        onToAnotherAddressModal={onToAnotherAddressModal}
        onSelectPercentageStage={onSelectPercentageStage}
      />
      <StockTradeStatusAlert stockChannel={stockChannel} />
      {stockChannel.readyForQuote ? (
        <SwapQuoteResult
          refreshAction={refreshAction}
          onOpenProviderList={onOpenProviderList}
          quoteResult={quoteResult}
        />
      ) : null}
      {alerts.states.length > 0 &&
      !quoteLoading &&
      !quoteEventFetching &&
      alerts?.quoteId === (quoteResult?.quoteId ?? '') ? (
        <SwapAlertContainer alerts={alerts.states} />
      ) : null}
    </YStack>
  );
}

function StockMarketHeaderSkeleton() {
  return (
    <XStack alignItems="center" justifyContent="space-between" h="$13">
      <XStack alignItems="center" gap="$2.5">
        <Skeleton w="$8" h="$8" radius="round" />
        <YStack gap="$1">
          <Skeleton h="$6" w="$24" />
          <Skeleton h="$4" w="$32" />
        </YStack>
      </XStack>
      <YStack alignItems="flex-end" gap="$1">
        <Skeleton h="$6" w="$16" />
        <Skeleton h="$4" w="$12" />
      </YStack>
    </XStack>
  );
}

function StockMarketTokenHeader({
  stockChannel,
  compact,
}: {
  stockChannel: IUseSwapStockChannelReturn;
  compact?: boolean;
}) {
  const { tokenDetail, networkId } = useTokenDetail();
  const navigation = useAppNavigation();
  const effectiveNetworkLogoUri = useNetworkLogoUri({
    logoUri: undefined,
    networkId,
  });
  const stock = tokenDetail?.stock;
  const handleOpenMobileTokenSelector = useCallback(() => {
    navigation.pushModal(EModalRoutes.MarketModal, {
      screen: EModalMarketRoutes.MobileTokenSelector,
      params: {
        mode: 'stock',
        selectTarget: 'swapStock',
      },
    });
  }, [navigation]);

  if (!tokenDetail) {
    return <StockMarketHeaderSkeleton />;
  }

  return (
    <XStack
      testID={SwapTestIDs.stockMarketTokenHeader}
      alignItems="flex-start"
      justifyContent="space-between"
      minHeight={compact ? '$11' : undefined}
      gap="$3"
    >
      <YStack minWidth={0} flex={1} gap="$1">
        {compact ? (
          <XStack
            gap="$2.5"
            alignItems="center"
            cursor="pointer"
            bg="$transparent"
            px="$0"
            py="$0"
            borderRadius="$full"
            hoverStyle={{ bg: '$bgHover' }}
            pressStyle={{ bg: '$bgActive' }}
            onPress={handleOpenMobileTokenSelector}
          >
            <Token
              size="md"
              tokenImageUri={tokenDetail.logoUrl}
              tokenImageUris={tokenDetail.logoUrls}
              networkImageUri={effectiveNetworkLogoUri}
              showNetworkIconBorder={false}
              bg="$transparent"
              fallbackIcon="CryptoCoinOutline"
            />
            <SizableText
              size="$headingSm"
              color="$text"
              numberOfLines={1}
              ellipsizeMode="tail"
              maxWidth="$32"
              flexShrink={1}
            >
              {tokenDetail.symbol}
            </SizableText>
            <Icon
              name="ChevronDownSmallOutline"
              size="$5"
              color="$iconSubdued"
            />
          </XStack>
        ) : (
          <MarketTokenSelector
            mode="stock"
            triggerVariant="compact"
            onSelectToken={stockChannel.selectStockToken}
          />
        )}
        <XStack ml="$10" alignItems="center" gap="$1" minHeight="$5">
          {stock?.subtitle ? (
            <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
              {stock.subtitle}
            </SizableText>
          ) : null}
          <StockSourceLogo stock={stock} />
          {stock ? <StockIsOpenBadge stock={stock} /> : null}
        </XStack>
      </YStack>
      <YStack alignItems="flex-end" minWidth={compact ? '$20' : '$24'}>
        <BaseMarketTokenPrice
          size={compact ? '$bodyLg' : '$bodyLg'}
          color="$text"
          price={tokenDetail.price ?? tokenDetail.priceConverted ?? ''}
          tokenName={tokenDetail.name}
          tokenSymbol={tokenDetail.symbol}
          lastUpdated={String(tokenDetail.lastUpdated ?? '')}
          currency="$"
        />
        <PriceChangePercentage size="$bodySm">
          {tokenDetail.priceChange24hPercent}
        </PriceChangePercentage>
      </YStack>
    </XStack>
  );
}

function StockPriceChart({
  isNative,
  networkId,
  tokenAddress,
}: {
  isNative?: boolean;
  networkId?: string;
  tokenAddress?: string;
}) {
  const [range, setRange] = useState<IStockChartRange>('1D');
  const activeRange = useMemo(
    () => STOCK_CHART_RANGE_ITEMS.find((item) => item.label === range),
    [range],
  );
  const chartScope = `${networkId ?? ''}:${tokenAddress ?? ''}:${
    isNative ? 'native' : 'token'
  }:${range}`;
  const { result: chartState, isLoading } = usePromiseResult(
    async () => {
      if (!networkId || (!tokenAddress && !isNative) || !activeRange) {
        return {
          scope: chartScope,
          data: [] as IMarketTokenChart,
        };
      }
      const timeTo = Math.floor(Date.now() / 1000);
      const timeFrom = timeTo - activeRange.seconds;
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenKline({
          tokenAddress: tokenAddress ?? '',
          networkId,
          interval: activeRange.interval,
          timeFrom,
          timeTo,
          autoHandleError: false,
        });
      return {
        scope: chartScope,
        data: normalizeStockChartData(response?.points),
      };
    },
    [activeRange, chartScope, isNative, networkId, tokenAddress],
    {
      initResult: {
        scope: '',
        data: [] as IMarketTokenChart,
      },
      watchLoading: true,
    },
  );
  const chartData =
    chartState.scope === chartScope
      ? chartState.data
      : ([] as IMarketTokenChart);
  const priceFormatter = useCallback(
    (price: number) =>
      numberFormat(String(price), {
        formatter: 'price',
        formatterOptions: { currency: '$' },
      }),
    [],
  );

  let chartContent: ReactNode = (
    <YStack flex={1} alignItems="center" justifyContent="center">
      <SizableText size="$bodySm" color="$textSubdued">
        --
      </SizableText>
    </YStack>
  );
  if (isLoading) {
    chartContent = <Skeleton w="100%" h="100%" />;
  } else if (chartData.length > 0) {
    chartContent = (
      <LightweightChart
        data={chartData}
        height={220}
        lineColor="#008347D6"
        topColor="#00834700"
        bottomColor="#00834700"
        lineWidth={2}
        showPriceScale
        showDottedArea
        dottedAreaColor="#008347D6"
        dottedAreaOpacity={0.36}
        priceFormatter={priceFormatter}
        fontSize={11}
      />
    );
  }

  return (
    <YStack h={274} borderRadius="$4" bg="$bgSubdued" overflow="hidden">
      <XStack px="$3" pt="$3" gap="$1.5">
        {STOCK_CHART_RANGE_ITEMS.map((item) => {
          const active = item.label === range;
          return (
            <XStack
              key={item.label}
              h="$7"
              px="$2.5"
              borderRadius="$2"
              alignItems="center"
              justifyContent="center"
              bg={active ? '$bgActive' : '$transparent'}
              userSelect="none"
              cursor="pointer"
              onPress={() => setRange(item.label)}
            >
              <SizableText
                size="$bodySmMedium"
                color={active ? '$text' : '$textSubdued'}
              >
                {item.label}
              </SizableText>
            </XStack>
          );
        })}
      </XStack>
      <Stack flex={1} minHeight={0} px="$2" pb="$2">
        {chartContent}
      </Stack>
    </YStack>
  );
}

function StockMarketContextPanel({
  stockChannel,
}: {
  stockChannel: IUseSwapStockChannelReturn;
}) {
  const { tokenDetail, tokenAddress, networkId, isNative } = useTokenDetail();
  const chartReady = !!networkId && !!tokenDetail?.symbol;

  return (
    <YStack
      testID={SwapTestIDs.stockMarketPanel}
      w={526}
      flexShrink={0}
      minHeight={623}
      p="$6"
      borderWidth="$px"
      borderColor="$borderSubdued"
      borderRadius="$5"
      bg="$bg"
    >
      <StockMarketTokenHeader stockChannel={stockChannel} />

      <Stack mt="$6" mb="$2.5">
        {chartReady ? (
          <StockPriceChart
            tokenAddress={tokenAddress ?? ''}
            networkId={networkId ?? ''}
            isNative={isNative}
          />
        ) : (
          <Skeleton w="100%" h={274} />
        )}
      </Stack>

      <Divider mb="$3" />
      <StockMarketDataGrid />
    </YStack>
  );
}

function SwapStockDesktopContent({
  headerContent,
  storeName,
  onSelectToken,
  fetchLoading,
  onSelectPercentageStage,
  onBalanceMaxPress,
  onPreSwap,
  onToAnotherAddressModal,
  onOpenProviderList,
  refreshAction,
  quoteResult,
  quoteLoading,
  quoteEventFetching,
  alerts,
}: ISwapStockDesktopContainerProps) {
  const intl = useIntl();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSwapParamList>>();
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const stockChannel = useSwapStockTradeContext();

  const handleTradeSideChange = useCallback(
    (nextTradeSide: ESwapStockTradeSide) => {
      if (nextTradeSide === stockChannel.tradeSide) {
        return;
      }
      setFromTokenAmount({ value: '', isInput: false });
      setToTokenAmount({ value: '', isInput: false });
      void stockChannel.switchTradeSide(nextTradeSide);
    },
    [setFromTokenAmount, setToTokenAmount, stockChannel],
  );

  const onOpenHistoryListModal = useCallback(() => {
    dismissKeyboard();
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapHistoryList,
      params: {
        type: EProtocolOfExchange.STOCK,
        storeName,
      },
    });
  }, [navigation, storeName]);

  return (
    <YStack width="100%" alignItems="center" pt="$5" pb="$5">
      <YStack width="100%" maxWidth={960} gap="$7">
        {headerContent ? (
          <XStack h="$14" alignItems="center" justifyContent="center">
            {headerContent}
          </XStack>
        ) : null}
        <XStack width="100%" gap="$6" alignItems="flex-start">
          <YStack
            w={410}
            flexShrink={0}
            minHeight={466}
            p="$6"
            borderWidth="$px"
            borderColor="$borderSubdued"
            borderRadius="$5"
            bg="$bg"
            gap="$5"
          >
            <XStack alignItems="center" justifyContent="space-between">
              <SizableText size="$headingLg" color="$text">
                {intl.formatMessage({
                  id: ETranslations.perps_token_selector_stocks,
                })}
              </SizableText>
              <IconButton
                testID="swap-stock-history-button"
                icon="ClockTimeHistoryOutline"
                size="small"
                variant="tertiary"
                onPress={onOpenHistoryListModal}
              />
            </XStack>
            <StockTradeTicket
              onSelectToken={onSelectToken}
              fetchLoading={fetchLoading}
              onSelectPercentageStage={onSelectPercentageStage}
              onBalanceMaxPress={onBalanceMaxPress}
              onPreSwap={onPreSwap}
              onToAnotherAddressModal={onToAnotherAddressModal}
              onOpenProviderList={onOpenProviderList}
              refreshAction={refreshAction}
              quoteResult={quoteResult}
              quoteLoading={quoteLoading}
              quoteEventFetching={quoteEventFetching}
              alerts={alerts}
              stockChannel={stockChannel}
              tradeSide={stockChannel.tradeSide}
              onTradeSideChange={handleTradeSideChange}
            />
          </YStack>
          <StockMarketContextPanel stockChannel={stockChannel} />
        </XStack>
      </YStack>
    </YStack>
  );
}

export function SwapStockDesktopContainer(
  props: ISwapStockDesktopContainerProps,
) {
  const { tokenDetail } = useTokenDetail();

  return (
    <SwapStockTradeProvider
      marketPresetToken={props.marketPresetToken}
      disableNativePayToken={isOndoStockSource(tokenDetail?.stock?.source)}
    >
      <SwapStockDesktopContent {...props} />
    </SwapStockTradeProvider>
  );
}

function SwapStockMobileContent(props: ISwapStockDesktopContainerProps) {
  const tabBarHeight = useScrollContentTabBarOffset();
  const scrollViewRef = useRef<KeyboardAwareScrollViewRef>(null);
  const bottomOffset = KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET + 60;
  const [, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [, setToTokenAmount] = useSwapToTokenAmountAtom();
  const stockChannel = useSwapStockTradeContext();

  const handleTradeSideChange = useCallback(
    (nextTradeSide: ESwapStockTradeSide) => {
      if (nextTradeSide === stockChannel.tradeSide) {
        return;
      }
      setFromTokenAmount({ value: '', isInput: false });
      setToTokenAmount({ value: '', isInput: false });
      void stockChannel.switchTradeSide(nextTradeSide);
    },
    [setFromTokenAmount, setToTokenAmount, stockChannel],
  );

  return (
    <Keyboard.AwareScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ref={scrollViewRef}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
      bottomOffset={bottomOffset}
    >
      <YStack
        testID={SwapTestIDs.stockMobileContainer}
        pt="$2.5"
        px="$5"
        pb="$5"
        gap="$4"
        flex={1}
      >
        <StockMarketTokenHeader stockChannel={stockChannel} compact />
        <StockTradeTicket
          onSelectToken={props.onSelectToken}
          fetchLoading={props.fetchLoading}
          onSelectPercentageStage={props.onSelectPercentageStage}
          onBalanceMaxPress={props.onBalanceMaxPress}
          onPreSwap={props.onPreSwap}
          onToAnotherAddressModal={props.onToAnotherAddressModal}
          onOpenProviderList={props.onOpenProviderList}
          refreshAction={props.refreshAction}
          quoteResult={props.quoteResult}
          quoteLoading={props.quoteLoading}
          quoteEventFetching={props.quoteEventFetching}
          alerts={props.alerts}
          stockChannel={stockChannel}
          tradeSide={stockChannel.tradeSide}
          onTradeSideChange={handleTradeSideChange}
          compact
        />
      </YStack>
    </Keyboard.AwareScrollView>
  );
}

export function SwapStockMobileContainer(
  props: ISwapStockDesktopContainerProps,
) {
  const { tokenDetail } = useTokenDetail();

  return (
    <SwapStockTradeProvider
      marketPresetToken={props.marketPresetToken}
      disableNativePayToken={isOndoStockSource(tokenDetail?.stock?.source)}
    >
      <SwapStockMobileContent {...props} />
    </SwapStockTradeProvider>
  );
}

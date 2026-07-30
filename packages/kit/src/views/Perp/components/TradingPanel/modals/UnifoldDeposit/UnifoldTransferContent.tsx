// cspell: words unifold Unifold hypercore Hypercore
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import {
  DashText,
  Dialog,
  Empty,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  UNIFOLD_ARBITRUM_CHAIN_ID,
  UNIFOLD_ARBITRUM_USDC_SYMBOL,
  UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL,
} from '@onekeyhq/kit/src/views/Perp/consts/unifold';
import { usePerpsUnifoldDepositSession } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import type {
  IUnifoldDepositErrorType,
  IUnifoldSourceSelection,
} from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import { UNIFOLD_THIRD_PARTY_CONVERSION_FEE_PERCENT } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IUnifoldSourceSelectorResult } from '@onekeyhq/shared/src/routes/perp';
import { parseUnifoldExecutionCreatedAtMs } from '@onekeyhq/shared/src/utils/unifoldDepositUtils';
import type {
  IUnifoldSupportedAsset,
  IUnifoldSupportedAssetChain,
} from '@onekeyhq/shared/types/unifoldDeposit';

import { UnifoldDepositHistoryCard } from './UnifoldDepositHistoryCard';
import { UnifoldDepositQRCard } from './UnifoldDepositQRCard';
import {
  formatUnifoldProcessingTime,
  formatUnifoldRouteAssetDescription,
  formatUnifoldUsd,
  normalizeUnifoldIconUrl,
} from './unifoldFormat';
import { UnifoldSourceSelector } from './UnifoldSourceSelector';

// HyperCore uses the same Hyperliquid brand mark as the preset HyperEVM
// network, while dev's plain-chain destination keeps its own chain icon.
const HYPERLIQUID_NETWORK_ICON_URI = getPresetNetworks().find(
  (network) => network.shortcode === 'hyperevm',
)?.logoURI;
const THIRD_PARTY_CONVERSION_FEE = `${UNIFOLD_THIRD_PARTY_CONVERSION_FEE_PERCENT.toFixed(
  2,
)}%`;
const HISTORY_CARD_CONTENT_GAP = 4;
const HISTORY_CARD_POLL_INTERVAL_MS = 3000;
const RECENT_SUCCEEDED_WINDOW_MS = 2 * 60 * 1000;

function DetailRow({
  label,
  value,
  tooltip,
  compact = false,
}: {
  label: string;
  value: string;
  tooltip?: string;
  compact?: boolean;
}) {
  return (
    <XStack
      px={compact ? '$3' : '$4'}
      py={compact ? '$1.5' : '$2'}
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
    >
      {tooltip ? (
        <DashText
          size={compact ? '$bodySm' : '$bodyMd'}
          color="$textSubdued"
          dashColor="$textDisabled"
          dashThickness={0.5}
          flexShrink={0}
          tooltip={tooltip}
          tooltipTitle={label}
          tooltipPlacement="bottom-start"
        >
          {label}
        </DashText>
      ) : (
        <SizableText
          size={compact ? '$bodySm' : '$bodyMd'}
          color="$textSubdued"
          flexShrink={0}
        >
          {label}
        </SizableText>
      )}
      <SizableText
        size={compact ? '$bodySmMedium' : '$bodyMdMedium'}
        color="$text"
        flex={1}
        minWidth={0}
        textAlign="right"
        numberOfLines={1}
      >
        {value}
      </SizableText>
    </XStack>
  );
}

function DepositRouteRow({
  sourceTokenSymbol,
  sourceNetworkName,
  sourceTokenIconUri,
  sourceNetworkIconUri,
  receiveTokenSymbol,
  receiveNetworkName,
  receiveTokenIconUri,
  receiveNetworkIconUri,
}: {
  sourceTokenSymbol: string;
  sourceNetworkName?: string;
  sourceTokenIconUri?: string;
  sourceNetworkIconUri?: string;
  receiveTokenSymbol: string;
  receiveNetworkName?: string;
  receiveTokenIconUri?: string;
  receiveNetworkIconUri?: string;
}) {
  const intl = useIntl();
  const title = intl.formatMessage({
    id: ETranslations.perp_unifold_conversion_route__title,
  });
  const sourceTokenDescription = formatUnifoldRouteAssetDescription({
    tokenSymbol: sourceTokenSymbol,
    networkName: sourceNetworkName,
  });
  const receiveTokenDescription = formatUnifoldRouteAssetDescription({
    tokenSymbol: receiveTokenSymbol,
    networkName: receiveNetworkName,
  });

  return (
    <XStack
      px="$3"
      py="$1.5"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
    >
      <DashText
        size="$bodySm"
        color="$textSubdued"
        dashColor="$textDisabled"
        dashThickness={0.5}
        flexShrink={0}
        tooltip={intl.formatMessage(
          {
            id: ETranslations.perp_unifold_conversion_route_tokens__desc,
          },
          {
            sourceToken: sourceTokenDescription,
            receiveToken: receiveTokenDescription,
          },
        )}
        tooltipTitle={title}
        tooltipPlacement="bottom-start"
      >
        {title}
      </DashText>
      <XStack alignItems="center" justifyContent="flex-end" gap="$2.5">
        <XStack alignItems="center" gap="$1.5">
          <Token
            size="xxs"
            tokenImageUri={normalizeUnifoldIconUrl(sourceTokenIconUri)}
            networkImageUri={normalizeUnifoldIconUrl(sourceNetworkIconUri)}
          />
          <SizableText size="$bodySmMedium" color="$text">
            {sourceTokenSymbol}
          </SizableText>
        </XStack>
        <Icon name="ArrowRightOutline" size="$4" color="$iconSubdued" />
        <XStack alignItems="center" gap="$1.5">
          <Token
            size="xxs"
            tokenImageUri={normalizeUnifoldIconUrl(receiveTokenIconUri)}
            networkImageUri={normalizeUnifoldIconUrl(receiveNetworkIconUri)}
          />
          <SizableText size="$bodySmMedium" color="$text">
            {receiveTokenSymbol}
          </SizableText>
        </XStack>
      </XStack>
    </XStack>
  );
}

function ErrorState({
  errorType,
  sessionId,
}: {
  errorType: IUnifoldDepositErrorType;
  sessionId: string | null;
}) {
  const intl = useIntl();
  const copy: Record<
    IUnifoldDepositErrorType,
    { icon: Parameters<typeof Empty>[0]['icon']; title: string; body: string }
  > = {
    accountMismatch: {
      icon: 'ErrorOutline',
      // Covers both entry-time mismatch and an account switch made while this
      // panel was open, so it must not claim the address is merely stale.
      title: intl.formatMessage({
        id: ETranslations.feedback_address_mismatch,
      }),
      body: intl.formatMessage({
        id: ETranslations.active_trading_account_changed__msg,
      }),
    },
    disabled: {
      icon: 'ErrorOutline',
      title: intl.formatMessage({ id: ETranslations.provider_unavailable }),
      body: intl.formatMessage({
        id: ETranslations.global_unknown_error_retry_message,
      }),
    },
    geoBlocked: {
      icon: 'LocationMapOutline',
      title: intl.formatMessage({ id: ETranslations.provider_unavailable }),
      body: intl.formatMessage({ id: ETranslations.description_403 }),
    },
    unavailable: {
      icon: 'ErrorOutline',
      title: intl.formatMessage({ id: ETranslations.provider_unavailable }),
      body: intl.formatMessage({
        id: ETranslations.global_unknown_error_retry_message,
      }),
    },
    sanctioned: {
      icon: 'ErrorOutline',
      title: intl.formatMessage({ id: ETranslations.provider_unavailable }),
      body: sessionId
        ? intl.formatMessage(
            {
              id: ETranslations.perp_unifold_contact_support_ref__desc,
            },
            { ref: sessionId },
          )
        : intl.formatMessage({ id: ETranslations.swap_ch_status_hold }),
    },
    network: {
      icon: 'ErrorOutline',
      title: intl.formatMessage({
        id: ETranslations.perp_unifold_failed_create_address__title,
      }),
      body: intl.formatMessage(
        { id: ETranslations.perp_unifold_retry_automatically__desc },
        { seconds: 5 },
      ),
    },
  };
  const item = copy[errorType];
  return <Empty icon={item.icon} title={item.title} description={item.body} />;
}

// The panel body scrolls inside the desktop dialog (which clamps its height
// but is not itself a scroll container) and is left unbounded under a mobile
// Page, which already scrolls.
function BodyFrame({
  maxHeight,
  children,
}: {
  maxHeight?: number;
  children: React.ReactNode;
}) {
  if (maxHeight === undefined) {
    return <Stack>{children}</Stack>;
  }
  return (
    <ScrollView maxHeight={maxHeight} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  );
}

export type IUnifoldTransferContentRef = {
  selectSource: (
    asset: IUnifoldSupportedAsset,
    chain: IUnifoldSupportedAssetChain,
  ) => void;
};

export const UnifoldTransferContent = forwardRef<
  IUnifoldTransferContentRef,
  {
    expectedRecipient: string | null | undefined;
    onOpenTracker?: () => void;
    onTrackedExecutionCountChange?: (count: number) => void;
    bodyMaxHeight?: number;
    historyCardPlacement?: 'overlay' | 'pageFooter' | 'hidden';
    useDialogHeader?: boolean;
    useExternalHeader?: boolean;
    sourceSelectorResult?: IUnifoldSourceSelectorResult;
    onSourceSelectorResultHandled?: () => void;
    onSourceSelectorReady?: ({
      assets,
      asset,
      chain,
    }: {
      assets: IUnifoldSupportedAsset[];
      asset: IUnifoldSourceSelection['asset'];
      chain: IUnifoldSourceSelection['chain'];
    }) => void;
    onSourceSelectorUnavailable?: () => void;
    onOpenMobileTokenSelector?: () => void;
    onOpenMobileChainSelector?: () => void;
  }
>(
  (
    {
      expectedRecipient,
      onOpenTracker,
      onTrackedExecutionCountChange,
      bodyMaxHeight,
      historyCardPlacement = 'overlay',
      useDialogHeader = false,
      useExternalHeader = false,
      sourceSelectorResult,
      onSourceSelectorResultHandled,
      onSourceSelectorReady,
      onSourceSelectorUnavailable,
      onOpenMobileTokenSelector,
      onOpenMobileChainSelector,
    },
    ref,
  ) => {
    const intl = useIntl();
    const {
      recipientAddress,
      isLiveAccountAligned,
      isHyperCoreDestination,
      addressState,
      sessionId,
      supportedAssets,
      assetsLoading,
      selection,
      selectToken,
      selectChain,
      selectSource,
      qrAddress,
      sessionExecutions,
      acknowledgePresentedExecution,
      activationFee,
      showActivationWarning,
      activationRetrying,
    } = usePerpsUnifoldDepositSession({ enabled: true, expectedRecipient });
    const handledSourceSelectorRequestIdRef = useRef<string | null>(null);
    const [historyCardHeight, setHistoryCardHeight] = useState(0);

    useImperativeHandle(ref, () => ({ selectSource }), [selectSource]);

    useEffect(() => {
      if (!supportedAssets || !selection) {
        return;
      }
      onSourceSelectorReady?.({
        assets: supportedAssets,
        asset: selection.asset,
        chain: selection.chain,
      });
    }, [onSourceSelectorReady, selection, supportedAssets]);

    useEffect(() => {
      if (
        addressState.status === 'error' &&
        addressState.errorType !== 'network'
      ) {
        onSourceSelectorUnavailable?.();
      }
    }, [addressState, onSourceSelectorUnavailable]);

    useEffect(() => {
      if (
        !sourceSelectorResult ||
        !supportedAssets ||
        handledSourceSelectorRequestIdRef.current ===
          sourceSelectorResult.requestId
      ) {
        return;
      }
      const asset = supportedAssets?.find(
        (item) => item.symbol === sourceSelectorResult.assetSymbol,
      );
      const chain =
        sourceSelectorResult.mode === 'chain'
          ? asset?.chains.find(
              (item) =>
                item.chain_type === sourceSelectorResult.chainType &&
                item.chain_id === sourceSelectorResult.chainId,
            )
          : undefined;
      handledSourceSelectorRequestIdRef.current =
        sourceSelectorResult.requestId;
      if (!asset || (sourceSelectorResult.mode === 'chain' && !chain)) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.provider_unavailable,
          }),
          message: intl.formatMessage({
            id: ETranslations.global_unknown_error_retry_message,
          }),
        });
        onSourceSelectorResultHandled?.();
        return;
      }
      selectToken(asset);
      if (chain) {
        selectChain(chain);
      }
      onSourceSelectorResultHandled?.();
    }, [
      intl,
      onSourceSelectorResultHandled,
      selectChain,
      selectToken,
      sourceSelectorResult,
      supportedAssets,
    ]);

    const pendingSelection = useMemo(() => {
      if (!sourceSelectorResult || !supportedAssets) {
        return null;
      }
      const asset = supportedAssets.find(
        (item) => item.symbol === sourceSelectorResult.assetSymbol,
      );
      if (!asset) {
        return null;
      }
      const chain =
        sourceSelectorResult.mode === 'chain'
          ? asset.chains.find(
              (item) =>
                item.chain_type === sourceSelectorResult.chainType &&
                item.chain_id === sourceSelectorResult.chainId,
            )
          : (asset.chains.find(
              (item) => item.chain_id === selection?.chain.chain_id,
            ) ?? asset.chains[0]);
      return chain ? { asset, chain } : null;
    }, [selection?.chain.chain_id, sourceSelectorResult, supportedAssets]);
    const displaySelection = pendingSelection ?? selection;
    const chain = displaySelection?.chain;
    const receiveAsset = supportedAssets?.find(
      (asset) =>
        asset.symbol.toUpperCase() ===
        UNIFOLD_ARBITRUM_USDC_SYMBOL.toUpperCase(),
    );
    const receiveNetwork = isHyperCoreDestination
      ? undefined
      : receiveAsset?.chains.find(
          (item) => item.chain_id === UNIFOLD_ARBITRUM_CHAIN_ID,
        );
    const receiveNetworkIconUri = isHyperCoreDestination
      ? HYPERLIQUID_NETWORK_ICON_URI
      : receiveNetwork?.icon_url;
    const receiveNetworkName = isHyperCoreDestination
      ? 'HyperCore'
      : receiveNetwork?.chain_name;
    const receiveTokenSymbol = isHyperCoreDestination
      ? UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL
      : UNIFOLD_ARBITRUM_USDC_SYMBOL;
    const useCompactLayout = useDialogHeader || useExternalHeader;
    const succeededExecutions = useMemo(
      () => sessionExecutions.filter((item) => item.status === 'succeeded'),
      [sessionExecutions],
    );
    const historyCardEnabled = Boolean(
      onOpenTracker && recipientAddress && isLiveAccountAligned,
    );
    const { result: executionHistorySnapshot } = usePromiseResult(
      async () => {
        if (!historyCardEnabled || !recipientAddress) {
          return {
            executions: [],
            observedAt: Date.now(),
          };
        }
        const executions =
          await backgroundApiProxy.serviceUnifoldDeposit.listDepositExecutions({
            recipientAddress,
          });
        return {
          executions,
          observedAt: Date.now(),
        };
      },
      [historyCardEnabled, recipientAddress],
      {
        watchLoading: false,
        pollingInterval: historyCardEnabled
          ? HISTORY_CARD_POLL_INTERVAL_MS
          : undefined,
      },
    );
    const trackedExecutionCount = useMemo(() => {
      if (!executionHistorySnapshot) {
        return 0;
      }
      const recentSucceededCutoff =
        executionHistorySnapshot.observedAt - RECENT_SUCCEEDED_WINDOW_MS;
      return executionHistorySnapshot.executions.filter((item) => {
        if (!item.terminal) {
          return true;
        }
        if (item.status !== 'succeeded') {
          return false;
        }
        const createdAtMs = parseUnifoldExecutionCreatedAtMs(item.createdAt);
        return createdAtMs !== null && createdAtMs >= recentSucceededCutoff;
      }).length;
    }, [executionHistorySnapshot]);

    useEffect(() => {
      succeededExecutions.forEach(acknowledgePresentedExecution);
    }, [acknowledgePresentedExecution, succeededExecutions]);

    const historyCard = onOpenTracker ? (
      <UnifoldDepositHistoryCard
        trackedCount={trackedExecutionCount}
        onPress={onOpenTracker}
      />
    ) : null;
    const inPageFooter = historyCardPlacement === 'pageFooter';
    const historyCardHidden = historyCardPlacement === 'hidden';
    const historyCardReserve =
      historyCard && !inPageFooter && !historyCardHidden
        ? historyCardHeight + HISTORY_CARD_CONTENT_GAP
        : undefined;

    useEffect(() => {
      onTrackedExecutionCountChange?.(trackedExecutionCount);
    }, [onTrackedExecutionCountChange, trackedExecutionCount]);

    const withContentFrame = (body: React.ReactNode) => (
      <>
        {useDialogHeader ? (
          <Dialog.Header
            title={intl.formatMessage({
              id: ETranslations.perp_unifold_transfer_crypto__title,
            })}
          />
        ) : null}
        <Stack pb={inPageFooter ? undefined : '$3'}>
          <BodyFrame maxHeight={bodyMaxHeight}>
            <Stack pb={historyCardReserve}>{body}</Stack>
          </BodyFrame>
          {!inPageFooter && !historyCardHidden && historyCard ? (
            <Stack
              position="absolute"
              left="$0"
              right="$0"
              bottom="$0"
              pb="$3"
              onLayout={(event) =>
                setHistoryCardHeight(Math.ceil(event.nativeEvent.layout.height))
              }
            >
              {historyCard}
            </Stack>
          ) : null}
        </Stack>
        {inPageFooter && historyCard ? (
          <Page.Footer>
            <Stack px="$4" pb="$6">
              {historyCard}
            </Stack>
          </Page.Footer>
        ) : null}
      </>
    );

    if (
      addressState.status === 'error' &&
      addressState.errorType !== 'network'
    ) {
      return withContentFrame(
        <YStack py="$8">
          <ErrorState
            errorType={addressState.errorType}
            sessionId={sessionId}
          />
        </YStack>,
      );
    }

    return withContentFrame(
      <YStack gap="$3">
        <UnifoldSourceSelector
          assets={supportedAssets}
          selection={displaySelection}
          loading={Boolean(assetsLoading && !selection)}
          onSelectToken={selectToken}
          onSelectChain={selectChain}
          onOpenMobileTokenSelector={onOpenMobileTokenSelector}
          onOpenMobileChainSelector={onOpenMobileChainSelector}
        />

        {addressState.status === 'error' &&
        addressState.errorType === 'network' ? (
          <YStack bg="$bgCriticalSubdued" borderRadius="$3" p="$3" gap="$1.5">
            <XStack alignItems="center" gap="$1.5">
              <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
              <SizableText size="$bodySmMedium" color="$textCritical">
                {intl.formatMessage({
                  id: ETranslations.perp_unifold_failed_create_address__title,
                })}
              </SizableText>
            </XStack>
            <XStack alignItems="center" gap="$1.5">
              <Icon
                name="ClockTimeHistoryOutline"
                size="$3"
                color="$iconSubdued"
              />
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.perp_unifold_retry_automatically__desc,
                  },
                  { seconds: 5 },
                )}
              </SizableText>
            </XStack>
          </YStack>
        ) : null}

        {/* The address exists but its eligibility screen has not answered yet,
          so it stays hidden behind the QR skeleton. Says so rather than
          shimmering silently — and never claims the address itself failed. */}
        {activationRetrying && addressState.status !== 'error' ? (
          <YStack bg="$bgCautionSubdued" borderRadius="$3" p="$3" gap="$1.5">
            <XStack alignItems="center" gap="$1.5">
              <Icon name="InfoCircleOutline" size="$4" color="$iconCaution" />
              <SizableText size="$bodySmMedium" color="$textCaution">
                {intl.formatMessage({
                  id: ETranslations.perp_unifold_verifying_eligibility__title,
                })}
              </SizableText>
            </XStack>
            <XStack alignItems="center" gap="$1.5">
              <Icon
                name="ClockTimeHistoryOutline"
                size="$3"
                color="$iconSubdued"
              />
              <SizableText size="$bodySm" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.perp_unifold_retry_automatically__desc,
                  },
                  { seconds: 5 },
                )}
              </SizableText>
            </XStack>
          </YStack>
        ) : null}

        <UnifoldDepositQRCard
          address={qrAddress}
          chainIconUri={chain?.icon_url}
          sourceTokenSymbol={displaySelection?.asset.symbol}
          sourceTokenIconUri={displaySelection?.asset.icon_url}
          receiveTokenSymbol={receiveTokenSymbol}
          receiveTokenIconUri={receiveAsset?.icon_url}
          receiveNetworkIconUri={receiveNetworkIconUri}
          showConversionRoute={!useCompactLayout}
          // The QR needs both the address and a chain selection. Scoped to
          // 'ready' so a genuine address failure still shows its terminal
          // message instead of shimmering forever.
          loading={
            Boolean(assetsLoading) ||
            Boolean(sourceSelectorResult) ||
            addressState.status === 'loading' ||
            (addressState.status === 'ready' && !displaySelection)
          }
        />

        {showActivationWarning ? (
          <XStack
            testID="perps-unifold-activation-warning"
            bg="$bgInfoSubdued"
            borderRadius="$3"
            p="$3"
            gap="$2"
            alignItems="center"
          >
            <Icon name="InfoCircleOutline" size="$4" color="$iconInfo" />
            <SizableText size="$bodySm" color="$textInfo" flex={1}>
              {activationFee
                ? intl.formatMessage(
                    {
                      id: ETranslations.perp_unifold_account_activation_fee__desc,
                    },
                    { amount: formatUnifoldUsd(activationFee) },
                  )
                : intl.formatMessage({
                    id: ETranslations.perp_unifold_account_activation_fee_unknown__desc,
                  })}
            </SizableText>
          </XStack>
        ) : null}

        <YStack
          testID="perps-unifold-processing-details"
          bg={useCompactLayout ? undefined : '$bgStrong'}
          borderWidth={useCompactLayout ? '$px' : undefined}
          borderColor={useCompactLayout ? '$borderSubdued' : undefined}
          borderRadius="$3"
          py="$2"
          overflow="hidden"
        >
          {useCompactLayout && displaySelection?.asset.symbol ? (
            <DepositRouteRow
              sourceTokenSymbol={displaySelection.asset.symbol}
              sourceNetworkName={chain?.chain_name}
              sourceTokenIconUri={displaySelection.asset.icon_url}
              sourceNetworkIconUri={chain?.icon_url}
              receiveTokenSymbol={receiveTokenSymbol}
              receiveNetworkName={receiveNetworkName}
              receiveTokenIconUri={receiveAsset?.icon_url}
              receiveNetworkIconUri={receiveNetworkIconUri}
            />
          ) : null}
          {useCompactLayout ? (
            <DetailRow
              compact
              label={intl.formatMessage({
                id: ETranslations.perp_unifold_third_party_conversion_fee__title,
              })}
              value={THIRD_PARTY_CONVERSION_FEE}
              tooltip={intl.formatMessage(
                {
                  id: ETranslations.perp_unifold_deposit_route__desc,
                },
                { fee: THIRD_PARTY_CONVERSION_FEE },
              )}
            />
          ) : null}
          <DetailRow
            compact={useCompactLayout}
            label={intl.formatMessage({
              id: ETranslations.perp_unifold_processing_time__title,
            })}
            value={formatUnifoldProcessingTime(
              chain?.estimated_processing_time,
              intl,
            )}
          />
          <DetailRow
            compact={useCompactLayout}
            label={intl.formatMessage({
              id: ETranslations.perp_unifold_max_slippage__title,
            })}
            value={`${intl.formatMessage({
              id: ETranslations.global_auto,
            })} • ${(chain?.max_slippage_percent ?? 0.25).toFixed(2)}%`}
          />
          <DetailRow
            compact={useCompactLayout}
            label={intl.formatMessage({
              id: ETranslations.perp_unifold_price_impact__title,
            })}
            value={`${(chain?.estimated_price_impact_percent ?? 0).toFixed(2)}%`}
            tooltip={intl.formatMessage({
              id: ETranslations.perp_unifold_price_impact__desc,
            })}
          />
        </YStack>
      </YStack>,
    );
  },
);

UnifoldTransferContent.displayName = 'UnifoldTransferContent';

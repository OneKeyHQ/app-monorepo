// cspell: words unifold Unifold hypercore Hypercore
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
  useBackHandler,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import {
  UNIFOLD_ARBITRUM_CHAIN_ID,
  UNIFOLD_ARBITRUM_USDC_SYMBOL,
  UNIFOLD_HYPERCORE_USDC_PERP_SYMBOL,
} from '@onekeyhq/kit/src/views/Perp/consts/unifold';
import { usePerpsUnifoldDepositSession } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import type { IUnifoldDepositErrorType } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import { UNIFOLD_THIRD_PARTY_CONVERSION_FEE_PERCENT } from '@onekeyhq/shared/src/consts/perp';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IUnifoldSourceSelectorResult } from '@onekeyhq/shared/src/routes/perp';
import type { IUnifoldDepositExecution } from '@onekeyhq/shared/types/unifoldDeposit';

import { UnifoldDepositQRCard } from './UnifoldDepositQRCard';
import {
  UNIFOLD_STATUS_CARDS_CONTENT_GAP,
  UnifoldExecutionStatusCards,
} from './UnifoldExecutionStatusCards';
import {
  formatUnifoldProcessingTime,
  formatUnifoldRouteAssetDescription,
  formatUnifoldUsd,
  normalizeUnifoldIconUrl,
} from './unifoldFormat';
import { UnifoldSourceSelector } from './UnifoldSourceSelector';
import { UnifoldExecutionDetail } from './UnifoldTrackerContent';

// HyperCore uses the same Hyperliquid brand mark as the preset HyperEVM
// network, while dev's plain-chain destination keeps its own chain icon.
const HYPERLIQUID_NETWORK_ICON_URI = getPresetNetworks().find(
  (network) => network.shortcode === 'hyperevm',
)?.logoURI;
const THIRD_PARTY_CONVERSION_FEE = `${UNIFOLD_THIRD_PARTY_CONVERSION_FEE_PERCENT.toFixed(
  2,
)}%`;

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

export function UnifoldTransferContent({
  expectedRecipient,
  onPressExecution,
  bodyMaxHeight,
  statusCardsPlacement = 'overlay',
  useDialogHeader = false,
  useExternalHeader = false,
  detailExecutionId: controlledDetailExecutionId,
  onDetailExecutionIdChange,
  sourceSelectorResult,
  onSourceSelectorResultHandled,
}: {
  expectedRecipient: string | null | undefined;
  onPressExecution?: (execution: IUnifoldDepositExecution) => void;
  bodyMaxHeight?: number;
  // 'pageFooter' pins the cards to a mobile Page footer; the default overlay
  // mode floats them over the panel. Only a host that owns a <Page> may ask
  // for the footer, so this must stay a prop rather than a platform check.
  statusCardsPlacement?: 'overlay' | 'pageFooter';
  useDialogHeader?: boolean;
  useExternalHeader?: boolean;
  detailExecutionId?: string | null;
  onDetailExecutionIdChange?: (executionId: string | null) => void;
  sourceSelectorResult?: IUnifoldSourceSelectorResult;
  onSourceSelectorResultHandled?: () => void;
}) {
  const intl = useIntl();
  const [dismissedExecutionStatuses, setDismissedExecutionStatuses] = useState<
    Partial<Record<string, IUnifoldDepositExecution['status']>>
  >({});
  const [statusCardsHeight, setStatusCardsHeight] = useState(0);
  const [internalDetailExecutionId, setInternalDetailExecutionId] = useState<
    string | null
  >(null);
  const {
    isHyperCoreDestination,
    addressState,
    sessionId,
    supportedAssets,
    assetsLoading,
    selection,
    selectToken,
    selectChain,
    qrAddress,
    sessionExecutions,
    acknowledgePresentedExecution,
    activationFee,
    showActivationWarning,
    activationRetrying,
  } = usePerpsUnifoldDepositSession({ enabled: true, expectedRecipient });
  const handledSourceSelectorRequestIdRef = useRef<string | null>(null);

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
    handledSourceSelectorRequestIdRef.current = sourceSelectorResult.requestId;
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

  const handleDismiss = useCallback(
    (executionId: string) => {
      const execution = sessionExecutions.find(
        (item) => item.executionId === executionId,
      );
      if (!execution) {
        return;
      }
      setDismissedExecutionStatuses((prev) => ({
        ...prev,
        [executionId]: execution.status,
      }));
    },
    [sessionExecutions],
  );

  useEffect(() => {
    setDismissedExecutionStatuses((prev) => {
      const currentStatuses = new Map(
        sessionExecutions.map(
          (execution) => [execution.executionId, execution.status] as const,
        ),
      );
      let changed = false;
      const next = { ...prev };
      Object.entries(next).forEach(([executionId, dismissedStatus]) => {
        if (currentStatuses.get(executionId) !== dismissedStatus) {
          delete next[executionId];
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [sessionExecutions]);

  const detailExecutionId =
    controlledDetailExecutionId === undefined
      ? internalDetailExecutionId
      : controlledDetailExecutionId;
  const setDetailExecutionId = useCallback(
    (executionId: string | null) => {
      if (controlledDetailExecutionId === undefined) {
        setInternalDetailExecutionId(executionId);
      }
      onDetailExecutionIdChange?.(executionId);
    },
    [controlledDetailExecutionId, onDetailExecutionIdChange],
  );

  useBackHandler(
    useCallback(() => {
      setDetailExecutionId(null);
      return true;
    }, [setDetailExecutionId]),
    platformEnv.isNativeAndroid && Boolean(detailExecutionId),
  );

  const chain = selection?.chain;
  const receiveAsset = supportedAssets?.find(
    (asset) =>
      asset.symbol.toUpperCase() === UNIFOLD_ARBITRUM_USDC_SYMBOL.toUpperCase(),
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
  const inPageFooter = statusCardsPlacement === 'pageFooter';
  const visibleExecutions = useMemo(
    () =>
      sessionExecutions.filter(
        (item) => dismissedExecutionStatuses[item.executionId] !== item.status,
      ),
    [dismissedExecutionStatuses, sessionExecutions],
  );
  const showStatusCards =
    visibleExecutions.length > 0 && detailExecutionId === null;
  const cardsReserve =
    inPageFooter || !showStatusCards
      ? undefined
      : statusCardsHeight + UNIFOLD_STATUS_CARDS_CONTENT_GAP;
  const detailExecution = detailExecutionId
    ? sessionExecutions.find((item) => item.executionId === detailExecutionId)
    : undefined;

  useEffect(() => {
    let presentedTerminalExecutions: IUnifoldDepositExecution[] = [];
    if (detailExecution?.terminal) {
      presentedTerminalExecutions = [detailExecution];
    } else if (detailExecutionId === null) {
      presentedTerminalExecutions = visibleExecutions.filter(
        (item) => item.terminal,
      );
    }
    presentedTerminalExecutions.forEach(acknowledgePresentedExecution);
  }, [
    acknowledgePresentedExecution,
    detailExecution,
    detailExecutionId,
    visibleExecutions,
  ]);

  const statusCards = showStatusCards ? (
    <UnifoldExecutionStatusCards
      executions={visibleExecutions}
      sessionId={sessionId}
      estimatedProcessingTimeSeconds={chain?.estimated_processing_time}
      onPressExecution={(execution) => {
        setDetailExecutionId(execution.executionId);
        onPressExecution?.(execution);
      }}
      onDismiss={handleDismiss}
      onHeightChange={inPageFooter ? undefined : setStatusCardsHeight}
      floating={!inPageFooter}
    />
  ) : null;

  let dialogHeader: React.ReactNode = null;
  if (useDialogHeader) {
    dialogHeader = detailExecutionId ? (
      <Dialog.Header>
        <XStack
          alignItems="center"
          gap="$2"
          cursor="pointer"
          onPress={() => setDetailExecutionId(null)}
        >
          <Icon name="ChevronLeftSmallOutline" size="$5" color="$icon" />
          <Dialog.Title>
            {intl.formatMessage({
              id: ETranslations.perp_unifold_deposit_details__title,
            })}
          </Dialog.Title>
        </XStack>
      </Dialog.Header>
    ) : (
      <Dialog.Header
        title={intl.formatMessage({
          id: ETranslations.perp_unifold_transfer_crypto__title,
        })}
      />
    );
  }

  // Give every content branch the same overlay host. When cards are visible,
  // reserve their measured height inside the desktop scroll body so bottom
  // rows can scroll fully above them.
  const withStatusCards = (body: React.ReactNode) => (
    <>
      {dialogHeader}
      <Stack pb={inPageFooter ? undefined : '$3'}>
        <BodyFrame maxHeight={bodyMaxHeight}>
          <Stack pb={cardsReserve}>{body}</Stack>
        </BodyFrame>
        {inPageFooter ? null : statusCards}
      </Stack>
      {inPageFooter && statusCards ? (
        <Page.Footer>
          <Stack px="$4" pb="$6">
            {statusCards}
          </Stack>
        </Page.Footer>
      ) : null}
    </>
  );

  if (addressState.status === 'error' && addressState.errorType !== 'network') {
    return withStatusCards(
      <YStack py="$8">
        <ErrorState errorType={addressState.errorType} sessionId={sessionId} />
      </YStack>,
    );
  }

  if (detailExecution) {
    return withStatusCards(
      <YStack>
        {useDialogHeader || useExternalHeader ? null : (
          <XStack
            pb="$2"
            alignItems="center"
            gap="$1"
            cursor="pointer"
            onPress={() => setDetailExecutionId(null)}
          >
            <Icon name="ChevronLeftSmallOutline" size="$5" color="$icon" />
            <SizableText size="$bodyMdMedium" color="$text">
              {intl.formatMessage({
                id: ETranslations.perp_unifold_deposit_details__title,
              })}
            </SizableText>
          </XStack>
        )}
        {/* Derived from the live poll result by id, so the detail keeps
            updating instead of freezing at the moment it was opened. */}
        {/* The estimate belongs to the SELECTED chain, but this execution may
            have been paid on a different one (the user can switch the source
            dropdown after depositing). Pass it only when the two provably
            match — otherwise the row is omitted rather than quoting one
            chain's timing for another chain's deposit. */}
        <UnifoldExecutionDetail
          execution={detailExecution}
          estimatedProcessingTimeSeconds={
            chain && detailExecution.sourceChainId === chain.chain_id
              ? chain.estimated_processing_time
              : undefined
          }
        />
      </YStack>,
    );
  }

  return withStatusCards(
    <YStack gap="$3">
      <UnifoldSourceSelector
        assets={supportedAssets}
        selection={selection}
        loading={Boolean(assetsLoading && !selection)}
        onSelectToken={selectToken}
        onSelectChain={selectChain}
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
        sourceTokenSymbol={selection?.asset.symbol}
        sourceTokenIconUri={selection?.asset.icon_url}
        receiveTokenSymbol={receiveTokenSymbol}
        receiveTokenIconUri={receiveAsset?.icon_url}
        receiveNetworkIconUri={receiveNetworkIconUri}
        showConversionRoute={!useCompactLayout}
        // The QR needs both the address and a chain selection. Scoped to
        // 'ready' so a genuine address failure still shows its terminal
        // message instead of shimmering forever.
        loading={
          Boolean(assetsLoading) ||
          addressState.status === 'loading' ||
          (addressState.status === 'ready' && !selection)
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
        {useCompactLayout && selection?.asset.symbol ? (
          <DepositRouteRow
            sourceTokenSymbol={selection.asset.symbol}
            sourceNetworkName={chain?.chain_name}
            sourceTokenIconUri={selection.asset.icon_url}
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
}

// cspell: words unifold Unifold hypercore Hypercore
import { useCallback, useState } from 'react';

import {
  DashText,
  Dialog,
  Empty,
  Icon,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useBackHandler,
} from '@onekeyhq/components';
import {
  UNIFOLD_ARBITRUM_CHAIN_ID,
  UNIFOLD_ARBITRUM_USDC_SYMBOL,
} from '@onekeyhq/kit/src/views/Perp/consts/unifold';
import { usePerpsUnifoldDepositSession } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import type { IUnifoldDepositErrorType } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IUnifoldDepositExecution } from '@onekeyhq/shared/types/unifoldDeposit';

import { UnifoldDepositQRCard } from './UnifoldDepositQRCard';
import { UnifoldExecutionStatusCards } from './UnifoldExecutionStatusCards';
import { formatUnifoldProcessingTime, formatUnifoldUsd } from './unifoldFormat';
import { UnifoldSourceSelector } from './UnifoldSourceSelector';
import { UnifoldExecutionDetail } from './UnifoldTrackerContent';

// HyperCore uses the same Hyperliquid brand mark as the preset HyperEVM
// network, while dev's plain-chain destination keeps its own chain icon.
const HYPERLIQUID_NETWORK_ICON_URI = getPresetNetworks().find(
  (network) => network.shortcode === 'hyperevm',
)?.logoURI;

function DetailRow({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <XStack
      px="$4"
      py="$2"
      alignItems="center"
      justifyContent="space-between"
      gap="$3"
    >
      {tooltip ? (
        <DashText
          size="$bodyMd"
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
        <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
          {label}
        </SizableText>
      )}
      <SizableText
        size="$bodyMdMedium"
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

function ErrorState({
  errorType,
  sessionId,
  message,
}: {
  errorType: IUnifoldDepositErrorType;
  sessionId: string | null;
  message?: string;
}) {
  const copy: Record<
    IUnifoldDepositErrorType,
    { icon: Parameters<typeof Empty>[0]['icon']; title: string; body: string }
  > = {
    accountMismatch: {
      icon: 'ErrorOutline',
      // Covers both entry-time mismatch and an account switch made while this
      // panel was open, so it must not claim the address is merely stale.
      title: 'Deposit unavailable',
      body: 'The active account no longer matches this deposit address. Close and reopen the deposit window.',
    },
    disabled: {
      icon: 'ErrorOutline',
      title: 'Deposit unavailable',
      body: 'This deposit method is temporarily unavailable. Please use another method.',
    },
    geoBlocked: {
      icon: 'LocationMapOutline',
      title: 'Not available in your region',
      body: 'This deposit method is not available from your current location.',
    },
    unavailable: {
      icon: 'ErrorOutline',
      title: 'Deposit unavailable',
      body: 'This deposit method is temporarily unavailable. Please try again later or use another method.',
    },
    sanctioned: {
      icon: 'ErrorOutline',
      title: 'Unable to receive funds',
      body: sessionId
        ? `Please contact support. Ref ${sessionId}`
        : 'Please contact support.',
    },
    network: {
      icon: 'ErrorOutline',
      title: 'Failed to create deposit address',
      body: message || 'Retrying automatically every 5 seconds...',
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
}) {
  const [dismissedExecutionIds, setDismissedExecutionIds] = useState<string[]>(
    [],
  );
  const [internalDetailExecutionId, setInternalDetailExecutionId] = useState<
    string | null
  >(null);
  const {
    recipientAddress,
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
    activationFee,
    showActivationWarning,
    activationRetrying,
  } = usePerpsUnifoldDepositSession({ enabled: true, expectedRecipient });

  const handleDismiss = useCallback((executionId: string) => {
    setDismissedExecutionIds((prev) =>
      prev.includes(executionId) ? prev : [...prev, executionId],
    );
  }, []);

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
  const inPageFooter = statusCardsPlacement === 'pageFooter';
  const visibleExecutions = sessionExecutions.filter(
    (item) => !dismissedExecutionIds.includes(item.executionId),
  );
  const showStatusCards =
    visibleExecutions.length > 0 && detailExecutionId === null;

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
          <Dialog.Title>Deposit Details</Dialog.Title>
        </XStack>
      </Dialog.Header>
    ) : (
      <Dialog.Header title="Transfer Crypto" />
    );
  }

  // Cards stay mounted in every branch below: a veto or an open detail must
  // never hide deposits that are still moving.
  const withStatusCards = (body: React.ReactNode) => (
    <>
      {dialogHeader}
      <Stack pb={inPageFooter ? undefined : '$3'}>
        <BodyFrame maxHeight={bodyMaxHeight}>
          <Stack>{body}</Stack>
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
        <ErrorState
          errorType={addressState.errorType}
          sessionId={sessionId}
          message={addressState.message}
        />
      </YStack>,
    );
  }

  const detailExecution = detailExecutionId
    ? sessionExecutions.find((item) => item.executionId === detailExecutionId)
    : undefined;
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
              Deposit Details
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
        loading={Boolean(assetsLoading)}
        onSelectToken={selectToken}
        onSelectChain={selectChain}
      />

      {addressState.status === 'error' &&
      addressState.errorType === 'network' ? (
        <YStack bg="$bgCriticalSubdued" borderRadius="$3" p="$3" gap="$1.5">
          <XStack alignItems="center" gap="$1.5">
            <Icon name="InfoCircleOutline" size="$4" color="$iconCritical" />
            <SizableText size="$bodySmMedium" color="$textCritical">
              Failed to create deposit address
            </SizableText>
          </XStack>
          {addressState.message ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {addressState.message}
            </SizableText>
          ) : null}
          <XStack alignItems="center" gap="$1.5">
            <Icon
              name="ClockTimeHistoryOutline"
              size="$3"
              color="$iconSubdued"
            />
            <SizableText size="$bodySm" color="$textSubdued">
              Retrying automatically every 5 seconds...
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
              Verifying deposit eligibility
            </SizableText>
          </XStack>
          <XStack alignItems="center" gap="$1.5">
            <Icon
              name="ClockTimeHistoryOutline"
              size="$3"
              color="$iconSubdued"
            />
            <SizableText size="$bodySm" color="$textSubdued">
              Retrying automatically every 5 seconds...
            </SizableText>
          </XStack>
        </YStack>
      ) : null}

      <UnifoldDepositQRCard
        address={qrAddress}
        chainIconUri={chain?.icon_url}
        sourceTokenSymbol={selection?.asset.symbol}
        sourceTokenIconUri={selection?.asset.icon_url}
        receiveTokenSymbol={UNIFOLD_ARBITRUM_USDC_SYMBOL}
        receiveTokenIconUri={receiveAsset?.icon_url}
        receiveNetworkIconUri={receiveNetworkIconUri}
        // The QR needs both the address and a chain selection. Scoped to
        // 'ready' so a genuine address failure still shows its terminal
        // message instead of shimmering forever.
        loading={
          addressState.status === 'loading' ||
          (addressState.status === 'ready' && !selection)
        }
      />

      <YStack bg="$bgStrong" borderRadius="$3" py="$2" overflow="hidden">
        <DetailRow
          label="Processing time"
          value={formatUnifoldProcessingTime(chain?.estimated_processing_time)}
        />
        <DetailRow
          label="Max slippage"
          value={`Auto • ${(chain?.max_slippage_percent ?? 0.25).toFixed(2)}%`}
        />
        <DetailRow
          label="Price impact"
          value={`${(chain?.estimated_price_impact_percent ?? 0).toFixed(2)}%`}
          tooltip="Estimated difference between the quoted and executed conversion price. It can change with trade size and available liquidity."
        />
        {recipientAddress ? (
          <DetailRow
            label="Perps account"
            value={accountUtils.shortenAddress({
              address: recipientAddress,
              leadingLength: 8,
              trailingLength: 6,
            })}
          />
        ) : null}
      </YStack>

      {showActivationWarning ? (
        <XStack
          bg="$bgCautionSubdued"
          borderWidth="$px"
          borderColor="$borderCautionSubdued"
          borderRadius="$3"
          p="$3"
          gap="$2"
          alignItems="center"
        >
          <Icon name="ErrorOutline" size="$4" color="$iconCaution" />
          <SizableText size="$bodySm" color="$textCaution" flex={1}>
            {activationFee
              ? // Formatted like every other amount: the vendor sends a raw
                // decimal string, so "1" must not surface as "~$1".
                `~${formatUnifoldUsd(
                  activationFee,
                )} fee is required to activate a new HyperCore account.`
              : 'A one-time fee is required to activate a new HyperCore account.'}
          </SizableText>
        </XStack>
      ) : null}
    </YStack>,
  );
}

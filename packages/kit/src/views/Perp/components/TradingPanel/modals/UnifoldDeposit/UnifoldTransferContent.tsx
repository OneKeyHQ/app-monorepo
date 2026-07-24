// cspell: words unifold Unifold hypercore Hypercore
import { useCallback, useState } from 'react';

import {
  Empty,
  Icon,
  NATIVE_HIT_SLOP,
  Page,
  ScrollView,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { usePerpsUnifoldDepositSession } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import type { IUnifoldDepositErrorType } from '@onekeyhq/kit/src/views/Perp/hooks/usePerpsUnifoldDepositSession';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IUnifoldDepositExecution } from '@onekeyhq/shared/types/unifoldDeposit';

import { UnifoldDepositQRCard } from './UnifoldDepositQRCard';
import { UnifoldExecutionStatusCards } from './UnifoldExecutionStatusCards';
import { formatUnifoldProcessingTime, formatUnifoldUsd } from './unifoldFormat';
import { UnifoldSourceSelector } from './UnifoldSourceSelector';
import { UnifoldExecutionDetail } from './UnifoldTrackerContent';

const UNIFOLD_TERMS_URL = 'https://unifold.io/terms';
const UNIFOLD_HELP_URL = 'https://unifold.io/support';

function DetailRow({
  icon,
  label,
  value,
  onCopy,
}: {
  icon: Parameters<typeof Icon>[0]['name'];
  label: string;
  value: string;
  onCopy?: () => void;
}) {
  return (
    <XStack alignItems="center" gap="$2">
      <Stack borderRadius="$full" p="$1" bg="$bgInfoSubdued">
        <Icon name={icon} size="$3" color="$iconInfo" />
      </Stack>
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodySmMedium" color="$text" flex={1} minWidth={0}>
        {value}
      </SizableText>
      {onCopy ? (
        // Icon drops press handlers, so the affordance needs a real pressable
        // wrapper — and a touch target bigger than the 14pt glyph.
        <Stack
          role="button"
          p="$1"
          m="$-1"
          borderRadius="$2"
          cursor="pointer"
          userSelect="none"
          hitSlop={NATIVE_HIT_SLOP}
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
          onPress={onCopy}
        >
          <Icon name="Copy3Outline" size="$3.5" color="$iconSubdued" />
        </Stack>
      ) : null}
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
}: {
  expectedRecipient: string | null | undefined;
  onPressExecution?: (execution: IUnifoldDepositExecution) => void;
  bodyMaxHeight?: number;
  // 'pageFooter' pins the cards to a mobile Page footer; the default overlay
  // mode floats them over the panel. Only a host that owns a <Page> may ask
  // for the footer, so this must stay a prop rather than a platform check.
  statusCardsPlacement?: 'overlay' | 'pageFooter';
}) {
  const { copyText } = useClipboard();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [dismissedExecutionIds, setDismissedExecutionIds] = useState<string[]>(
    [],
  );
  const [statusCardsHeight, setStatusCardsHeight] = useState(0);
  const [detailExecutionId, setDetailExecutionId] = useState<string | null>(
    null,
  );
  const {
    recipientAddress,
    addressState,
    sessionId,
    supportedAssets,
    assetsLoading,
    selection,
    selectToken,
    selectChain,
    qrAddress,
    sessionExecutions,
    showWaitingUi,
    activationFee,
    showActivationWarning,
    activationRetrying,
  } = usePerpsUnifoldDepositSession({ enabled: true, expectedRecipient });

  const handleDismiss = useCallback((executionId: string) => {
    setDismissedExecutionIds((prev) =>
      prev.includes(executionId) ? prev : [...prev, executionId],
    );
  }, []);

  const chain = selection?.chain;
  const inPageFooter = statusCardsPlacement === 'pageFooter';
  const visibleExecutions = sessionExecutions.filter(
    (item) => !dismissedExecutionIds.includes(item.executionId),
  );
  // onLayout does not fire when the overlay unmounts, so the last measured
  // height has to be discarded explicitly once nothing is visible.
  const cardsReserve =
    inPageFooter || !visibleExecutions.length ? undefined : statusCardsHeight;

  const statusCards = visibleExecutions.length ? (
    <UnifoldExecutionStatusCards
      executions={visibleExecutions}
      sessionId={sessionId}
      estimatedProcessingTimeSeconds={chain?.estimated_processing_time}
      onPressExecution={(execution) => {
        setDetailExecutionId(execution.executionId);
        onPressExecution?.(execution);
      }}
      onDismiss={handleDismiss}
      onHeightChange={setStatusCardsHeight}
      floating={!inPageFooter}
    />
  ) : null;

  // Cards stay mounted in every branch below: a veto or an open detail must
  // never hide deposits that are still moving.
  const withStatusCards = (body: React.ReactNode) => (
    <>
      <Stack>
        <BodyFrame maxHeight={bodyMaxHeight}>
          <Stack pb={cardsReserve}>{body}</Stack>
        </BodyFrame>
        {inPageFooter ? null : statusCards}
      </Stack>
      {inPageFooter && statusCards ? (
        <Page.Footer>
          <Stack px="$4" pb="$2">
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
        <XStack
          px="$2"
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
        // The QR needs both the address and a chain selection. Scoped to
        // 'ready' so a genuine address failure still shows its terminal
        // message instead of shimmering forever.
        loading={
          addressState.status === 'loading' ||
          (addressState.status === 'ready' && !selection)
        }
      />

      <YStack
        px="$2.5"
        bg="$bgSubdued"
        borderRadius="$3"
        borderWidth="$px"
        borderColor="$borderSubdued"
      >
        <XStack
          py="$2.5"
          alignItems="center"
          justifyContent="space-between"
          cursor="pointer"
          onPress={() => setDetailsExpanded((v) => !v)}
        >
          <DetailRow
            icon="ClockTimeHistoryOutline"
            label="Processing time:"
            value={formatUnifoldProcessingTime(
              chain?.estimated_processing_time,
            )}
          />
          <Icon
            name={
              detailsExpanded
                ? 'ChevronTopSmallOutline'
                : 'ChevronDownSmallOutline'
            }
            size="$4"
            color="$iconSubdued"
          />
        </XStack>
        {detailsExpanded ? (
          <YStack pb="$3" gap="$2.5">
            <DetailRow
              icon="ShieldCheckDoneOutline"
              label="Max slippage:"
              value={`Auto • ${(chain?.max_slippage_percent ?? 0.25).toFixed(
                2,
              )}%`}
            />
            <DetailRow
              icon="DollarOutline"
              label="Price impact:"
              value={`${(chain?.estimated_price_impact_percent ?? 0).toFixed(
                2,
              )}%`}
            />
            {recipientAddress ? (
              <DetailRow
                icon="WalletCryptoOutline"
                label="Recipient address:"
                value={accountUtils.shortenAddress({
                  address: recipientAddress,
                  leadingLength: 8,
                  trailingLength: 6,
                })}
                onCopy={() => copyText(recipientAddress)}
              />
            ) : null}
          </YStack>
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

      <XStack alignItems="center" justifyContent="space-between">
        <XStack alignItems="center" gap="$1.5">
          {showWaitingUi ? (
            <>
              <Spinner size="small" />
              <SizableText size="$bodySm" color="$textSubdued">
                Checking for deposit
              </SizableText>
            </>
          ) : null}
        </XStack>
        <XStack alignItems="center" gap="$1">
          <SizableText
            size="$bodySm"
            color="$textInfo"
            cursor="pointer"
            onPress={() => openUrlExternal(UNIFOLD_TERMS_URL)}
          >
            Terms
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            |
          </SizableText>
          <SizableText
            size="$bodySm"
            color="$textInfo"
            cursor="pointer"
            onPress={() => openUrlExternal(UNIFOLD_HELP_URL)}
          >
            Help
          </SizableText>
        </XStack>
      </XStack>
    </YStack>,
  );
}

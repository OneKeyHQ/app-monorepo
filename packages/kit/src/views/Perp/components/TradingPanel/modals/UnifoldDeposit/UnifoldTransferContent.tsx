// cspell: words unifold Unifold hypercore Hypercore
import { useState } from 'react';

import {
  Empty,
  Icon,
  SizableText,
  Skeleton,
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
import { formatUnifoldProcessingTime } from './unifoldFormat';
import { UnifoldSourceSelector } from './UnifoldSourceSelector';

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
        <Icon
          name="Copy3Outline"
          size="$3.5"
          color="$iconSubdued"
          onPress={onCopy}
          cursor="pointer"
        />
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
      title: 'Deposit unavailable',
      body: 'Account address mismatch. Reopen the deposit window and try again.',
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
      body: 'Destination config mismatch',
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

export function UnifoldTransferContent({
  expectedRecipient,
  onPressExecution,
}: {
  expectedRecipient: string | null | undefined;
  onPressExecution?: (execution: IUnifoldDepositExecution) => void;
}) {
  const { copyText } = useClipboard();
  const [detailsExpanded, setDetailsExpanded] = useState(false);
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
  } = usePerpsUnifoldDepositSession({ enabled: true, expectedRecipient });

  if (addressState.status === 'error' && addressState.errorType !== 'network') {
    return (
      <YStack py="$8">
        <ErrorState
          errorType={addressState.errorType}
          sessionId={sessionId}
          message={addressState.message}
        />
      </YStack>
    );
  }

  const chain = selection?.chain;

  return (
    <Stack pb={sessionExecutions.length ? '$16' : undefined}>
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

        <UnifoldDepositQRCard
          address={qrAddress}
          chainIconUri={chain?.icon_url}
          loading={addressState.status === 'loading'}
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
                ? `~$${activationFee} fee is required to activate a new HyperCore account.`
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

        {assetsLoading && !selection ? (
          <YStack gap="$2">
            <Skeleton width="100%" height={64} radius={12} />
          </YStack>
        ) : null}
      </YStack>

      <UnifoldExecutionStatusCards
        executions={sessionExecutions}
        sessionId={sessionId}
        estimatedProcessingTimeSeconds={chain?.estimated_processing_time}
        onPressExecution={onPressExecution}
      />
    </Stack>
  );
}

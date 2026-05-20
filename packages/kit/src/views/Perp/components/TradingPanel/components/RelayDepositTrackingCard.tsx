import {
  Badge,
  IconButton,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IPerpsRelayDepositSessionAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { PerpTestIDs } from '../../../testIDs';
import {
  formatRelayDepositLastCheckedText,
  getRelayDepositBadgeType,
  getRelayDepositFinalStepDesc,
  getRelayDepositFinalStepTitle,
  getRelayDepositStatusLabel,
  getRelayDepositStepIndex,
  getRelayDepositTimelineDotBg,
  shortenRelayDepositTxHash,
} from '../../../utils/relayDepositTracking';

type IRelayDepositTrackingCardProps = {
  session: IPerpsRelayDepositSessionAtom;
  loading: boolean;
  onRefresh: () => void;
};

export function RelayDepositTrackingCard({
  session,
  loading,
  onRefresh,
}: IRelayDepositTrackingCardProps) {
  const stepIndex = getRelayDepositStepIndex(session);
  const terminalFailed =
    session.status === 'failure' || session.status === 'refund';
  const steps = [
    {
      title: 'Waiting for transfer',
      desc: 'Send from your wallet or exchange to the Relay address above.',
    },
    {
      title: 'Transfer detected',
      desc: 'Relay has detected the source-chain deposit.',
    },
    {
      title: 'Relay processing',
      desc: 'Relay is moving funds into your Hyperliquid Perps account.',
    },
    {
      title: getRelayDepositFinalStepTitle(session.status),
      desc: getRelayDepositFinalStepDesc(session.status),
    },
  ];

  return (
    <YStack
      testID={PerpTestIDs.RelayDepositTrackingCard}
      gap="$3"
      bg="$bgSubdued"
      borderRadius="$3"
      p="$3"
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$2">
        <YStack gap="$0.5" flex={1}>
          <XStack alignItems="center" gap="$2">
            <SizableText size="$bodyMdMedium">Deposit tracking</SizableText>
            <Badge
              badgeType={getRelayDepositBadgeType(
                session.status,
                session.inTxs.length > 0,
              )}
              badgeSize="sm"
            >
              {getRelayDepositStatusLabel(session.status, {
                hasSourceTx: session.inTxs.length > 0,
              })}
            </Badge>
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued">
            {formatRelayDepositLastCheckedText(session.lastCheckedAt)}
          </SizableText>
        </YStack>
        <IconButton
          testID={PerpTestIDs.RelayDepositTrackingRefreshButton}
          icon="RefreshCcwOutline"
          size="small"
          variant="tertiary"
          loading={loading}
          onPress={onRefresh}
        />
      </XStack>

      <YStack gap="$2.5">
        {steps.map((step, index) => {
          const active = index <= stepIndex;
          const isLast = index === steps.length - 1;
          const dotBg = getRelayDepositTimelineDotBg({
            active,
            terminalFailed,
            isLast,
          });
          return (
            <XStack key={step.title} gap="$2.5" alignItems="stretch">
              <YStack alignItems="center" pt="$0.5">
                <YStack
                  width={14}
                  height={14}
                  borderRadius="$full"
                  bg={dotBg}
                  alignItems="center"
                  justifyContent="center"
                >
                  {active ? (
                    <YStack
                      width={5}
                      height={5}
                      borderRadius="$full"
                      bg="$bgApp"
                    />
                  ) : null}
                </YStack>
                {!isLast ? (
                  <YStack
                    width="$px"
                    flex={1}
                    minHeight={18}
                    bg={active ? '$borderSuccess' : '$borderSubdued'}
                  />
                ) : null}
              </YStack>
              <YStack flex={1} gap="$0.5" pb={isLast ? undefined : '$1'}>
                <SizableText
                  size="$bodySmMedium"
                  color={active ? '$text' : '$textSubdued'}
                >
                  {step.title}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {step.desc}
                </SizableText>
              </YStack>
            </XStack>
          );
        })}
      </YStack>

      {session.inTxs[0]?.hash || session.outTxs[0]?.hash ? (
        <YStack gap="$1.5" pt="$1">
          {session.inTxs[0]?.hash ? (
            <XStack justifyContent="space-between" gap="$2">
              <SizableText size="$bodySm" color="$textSubdued">
                Source tx
              </SizableText>
              <SizableText size="$bodySmMedium">
                {shortenRelayDepositTxHash(session.inTxs[0].hash)}
              </SizableText>
            </XStack>
          ) : null}
          {session.outTxs[0]?.hash ? (
            <XStack justifyContent="space-between" gap="$2">
              <SizableText size="$bodySm" color="$textSubdued">
                Destination tx
              </SizableText>
              <SizableText size="$bodySmMedium">
                {shortenRelayDepositTxHash(session.outTxs[0].hash)}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      ) : null}

      {session.error ? (
        <SizableText size="$bodySm" color="$textCritical">
          {session.error}
        </SizableText>
      ) : null}
    </YStack>
  );
}

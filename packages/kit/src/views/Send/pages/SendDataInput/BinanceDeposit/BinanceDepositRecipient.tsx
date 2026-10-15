import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Button,
  Image,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/exchange';
import type { IBinanceDepositSnapshot } from '@onekeyhq/shared/types/exchange';

import { BINANCE_DEPOSIT_COPY } from './binanceDepositCopy';

import type { ImageSourcePropType } from 'react-native';

const BINANCE_LOGO: ImageSourcePropType = require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_binance.png');

export function BinanceDepositEntry({
  isLoading,
  onPress,
}: {
  isLoading: boolean;
  onPress: () => void;
}) {
  return (
    <ListItem
      testID="send-binance-deposit-entry"
      mx="$0"
      mt="$3"
      gap="$3"
      drillIn
      isLoading={isLoading}
      disabled={isLoading}
      onPress={onPress}
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      borderRadius="$3"
      userSelect="none"
    >
      <Image w="$10" h="$10" borderRadius="$full" source={BINANCE_LOGO} />
      <ListItem.Text
        flex={1}
        primary={BINANCE_DEPOSIT_COPY.accountName}
        secondary={BINANCE_DEPOSIT_COPY.entrySubtitle}
      />
    </ListItem>
  );
}

function CardMessage({
  title,
  description,
  isCritical,
}: {
  title: string;
  description: string;
  isCritical?: boolean;
}) {
  return (
    <YStack gap="$1">
      <SizableText
        size="$bodyMdMedium"
        color={isCritical ? '$textCritical' : '$text'}
      >
        {title}
      </SizableText>
      <SizableText size="$bodyMd" color="$textSubdued">
        {description}
      </SizableText>
    </YStack>
  );
}

function CardProgress({ text }: { text: string }) {
  return (
    <XStack gap="$2" alignItems="center">
      <Spinner size="small" />
      <SizableText size="$bodyMd" color="$textSubdued">
        {text}
      </SizableText>
    </XStack>
  );
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <XStack gap="$2">
      <SizableText size="$bodyMd" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium" flex={1}>
        {value}
      </SizableText>
    </XStack>
  );
}

// Replaces the address input while the recipient is the user's Binance
// account. The address is read-only: changing it leaves the Binance flow.
export function BinanceDepositRecipientCard({
  snapshot,
  isBusy,
  onOpenBinance,
  onRetry,
  onRestart,
  onExit,
}: {
  snapshot: IBinanceDepositSnapshot;
  isBusy: boolean;
  onOpenBinance: () => void;
  onRetry: () => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const intl = useIntl();
  const copy = BINANCE_DEPOSIT_COPY;
  const { phase, destination } = snapshot;

  let body: ReactNode = null;
  let primaryAction: { text: string; onPress: () => void } | undefined;
  let secondaryAction: { text: string; onPress: () => void } | undefined;
  switch (phase) {
    case 'creating':
      body = <CardProgress text={copy.creating} />;
      break;
    case 'confirming':
      body = <CardProgress text={copy.confirming} />;
      secondaryAction = { text: copy.cancel, onPress: onExit };
      break;
    case 'create_failed':
      body = (
        <CardMessage
          title={copy.createFailedTitle}
          description={copy.createFailedDesc}
          isCritical
        />
      );
      primaryAction = { text: copy.tryAgain, onPress: onRetry };
      secondaryAction = { text: copy.cancel, onPress: onExit };
      break;
    case 'awaiting':
      body = (
        <CardMessage
          title={copy.awaitingTitle}
          description={
            snapshot.status === EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND
              ? copy.awaitingUnboundDesc
              : copy.awaitingDesc
          }
        />
      );
      primaryAction = { text: copy.openBinance, onPress: onOpenBinance };
      secondaryAction = { text: copy.cancel, onPress: onExit };
      break;
    case 'authorized':
      body = destination ? (
        <YStack gap="$2">
          <SizableText size="$bodyLg" testID="send-binance-deposit-address">
            {destination.address}
          </SizableText>
          {destination.addressTag ? (
            <CardRow label={copy.tag} value={destination.addressTag} />
          ) : null}
          {destination.minAmount ? (
            <CardRow
              label={copy.minDeposit}
              value={`${destination.minAmount} ${destination.cryptoCurrency}`}
            />
          ) : null}
        </YStack>
      ) : null;
      break;
    default: {
      const failed = copy.failed[snapshot.failReason ?? 'session_lost'];
      body = (
        <CardMessage
          title={failed.title}
          description={failed.desc}
          isCritical
        />
      );
      primaryAction = { text: copy.startAgain, onPress: onRestart };
      secondaryAction = { text: copy.enterAddress, onPress: onExit };
    }
  }

  return (
    <YStack gap="$1.5" testID={`send-binance-deposit-card-${phase}`}>
      <SizableText size="$bodyMdMedium">
        {intl.formatMessage({ id: ETranslations.global_recipient })}
      </SizableText>
      <YStack
        p="$4"
        gap="$3"
        bg="$bgSubdued"
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderStrong"
      >
        <XStack alignItems="center" gap="$3">
          <Image w="$8" h="$8" borderRadius="$full" source={BINANCE_LOGO} />
          <SizableText flex={1} size="$bodyLgMedium">
            {copy.accountName}
          </SizableText>
          {phase === 'authorized' ? (
            <Button
              testID="send-binance-deposit-change"
              size="small"
              variant="tertiary"
              onPress={onExit}
            >
              {copy.change}
            </Button>
          ) : null}
        </XStack>
        {body}
        {primaryAction || secondaryAction ? (
          <XStack gap="$2">
            {primaryAction ? (
              <Button
                testID="send-binance-deposit-primary-action"
                size="small"
                variant="primary"
                loading={isBusy}
                onPress={primaryAction.onPress}
              >
                {primaryAction.text}
              </Button>
            ) : null}
            {secondaryAction ? (
              <Button
                testID="send-binance-deposit-secondary-action"
                size="small"
                onPress={secondaryAction.onPress}
              >
                {secondaryAction.text}
              </Button>
            ) : null}
          </XStack>
        ) : null}
      </YStack>
    </YStack>
  );
}

import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  Button,
  HeightTransition,
  Image,
  SizableText,
  Spinner,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { HighlightAddress } from '@onekeyhq/kit/src/components/HighlightAddress';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  MOTION_EASE_OUT,
  MOTION_ENTER_MS,
} from '@onekeyhq/kit/src/views/FiatCrypto/components/Headless/motionTokens';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/exchange';
import type { IBinanceDepositSnapshot } from '@onekeyhq/shared/types/exchange';

import { BINANCE_DEPOSIT_COPY } from './binanceDepositCopy';

import type { ImageSourcePropType } from 'react-native';

const BINANCE_LOGO: ImageSourcePropType = require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_binance.png');

const CARD_ENTERING = FadeIn.duration(MOTION_ENTER_MS).easing(MOTION_EASE_OUT);

// The entry and every state of the recipient card, failures included,
// share one background and corner radius; the radius matches the large
// address input these replace (the entry only shows on phones).
const CARD_FRAME = {
  p: '$4',
  gap: '$3',
  bg: '$neutral3',
  borderRadius: '$3',
  borderCurve: 'continuous',
} as const;

// Fades in when offered and pushes everything below down instead of
// jumping; collapses the same way while an address is being typed. Its gap
// to the input sits inside the transition, so it collapses too.
export function BinanceDepositEntry({
  hidden,
  onPress,
}: {
  hidden: boolean;
  onPress: () => void;
}) {
  return (
    <HeightTransition hide={hidden}>
      <ListItem
        testID="send-binance-deposit-entry"
        mx="$0"
        mt="$3"
        py="$3"
        gap="$3"
        drillIn
        onPress={onPress}
        bg={CARD_FRAME.bg}
        borderRadius={CARD_FRAME.borderRadius}
        borderCurve={CARD_FRAME.borderCurve}
        hoverStyle={{ bg: '$neutral4' }}
        pressStyle={{ bg: '$neutral5' }}
        userSelect="none"
      >
        <Image w="$8" h="$8" borderRadius="$full" source={BINANCE_LOGO} />
        <ListItem.Text flex={1} primary={BINANCE_DEPOSIT_COPY.accountName} />
      </ListItem>
    </HeightTransition>
  );
}

function CardMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <YStack gap="$1">
      <SizableText size="$bodyMdMedium">{title}</SizableText>
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

// Replaces the address input while the recipient is the user's Binance
// account. The address is read-only: leaving goes back to the plain input.
export function BinanceDepositRecipientCard({
  snapshot,
  isBusy,
  assetLabel,
  onOpenBinance,
  onRetry,
  onRestart,
  onExit,
}: {
  snapshot?: IBinanceDepositSnapshot;
  isBusy: boolean;
  assetLabel?: string;
  onOpenBinance: () => void;
  onRetry: () => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const intl = useIntl();
  const copy = BINANCE_DEPOSIT_COPY;
  // No snapshot yet: the entry was just tapped and the server hasn't answered.
  const phase = snapshot?.phase ?? 'creating';
  const cancelText = intl.formatMessage({ id: ETranslations.global_cancel });

  let body: ReactNode = null;
  let failure:
    | {
        isCritical?: boolean;
        title: string;
        description?: string;
        onTryAgain: () => void;
        secondary: string;
      }
    | undefined;
  switch (phase) {
    case 'creating':
      body = <CardProgress text={copy.opening} />;
      break;
    case 'confirming':
      body = <CardProgress text={copy.gettingAddress} />;
      break;
    case 'awaiting':
      // Confirmed in Binance, but the return never reached this phone: the
      // link can't be opened again, so only leaving is offered.
      body =
        snapshot?.status === EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND ? (
          <>
            <CardMessage
              title={copy.confirmedTitle}
              description={copy.confirmedDesc}
            />
            <XStack>
              <Button
                testID="send-binance-deposit-enter-address"
                size="small"
                onPress={onExit}
              >
                {copy.enterAddress}
              </Button>
            </XStack>
          </>
        ) : (
          <>
            <CardMessage
              title={copy.confirmTitle}
              description={copy.confirmDesc}
            />
            <XStack>
              <Button
                testID="send-binance-deposit-open"
                size="small"
                variant="primary"
                loading={isBusy}
                onPress={onOpenBinance}
              >
                {intl.formatMessage(
                  { id: ETranslations.receive_open_exchange },
                  { exchange: 'Binance' },
                )}
              </Button>
            </XStack>
          </>
        );
      break;
    case 'authorized':
      body = snapshot?.destination ? (
        <YStack gap="$2">
          <XStack flexWrap="wrap" testID="send-binance-deposit-address">
            <HighlightAddress
              address={snapshot.destination.address}
              size="$bodyLg"
              fontFamily="$monoRegular"
            />
          </XStack>
          {snapshot.destination.addressTag ? (
            <XStack gap="$2">
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({ id: ETranslations.send_tag })}
              </SizableText>
              <SizableText size="$bodyMd" fontFamily="$monoRegular" flex={1}>
                {snapshot.destination.addressTag}
              </SizableText>
            </XStack>
          ) : null}
        </YStack>
      ) : null;
      break;
    case 'create_failed':
      failure = {
        title: copy.connectFailed,
        onTryAgain: onRetry,
        secondary: cancelText,
      };
      break;
    default: {
      // Only a security stop reads as danger (its title); an expired,
      // declined or lost authorization all end the same way for the user.
      const isConflict = snapshot?.failReason === 'conflict';
      failure = {
        isCritical: isConflict,
        title: isConflict ? copy.securityFailedTitle : copy.addressFailed,
        description: isConflict ? copy.securityFailedDesc : undefined,
        onTryAgain: onRestart,
        secondary: copy.enterAddress,
      };
    }
  }

  return (
    <Animated.View entering={CARD_ENTERING}>
      <YStack gap="$1.5" testID={`send-binance-deposit-card-${phase}`}>
        {/* The way out sits at the right of the label in every state; a
            failure offers its own actions instead. */}
        <XStack alignItems="center" justifyContent="space-between" gap="$2">
          <SizableText size="$bodyMdMedium">
            {intl.formatMessage({ id: ETranslations.global_recipient })}
          </SizableText>
          {failure ? null : (
            <SizableText
              testID="send-binance-deposit-exit"
              size="$bodyMd"
              color="$textSubdued"
              cursor="pointer"
              hoverStyle={{ color: '$text' }}
              onPress={onExit}
            >
              {phase === 'authorized'
                ? intl.formatMessage({ id: ETranslations.global_clear })
                : cancelText}
            </SizableText>
          )}
        </XStack>
        {failure ? (
          <YStack testID="send-binance-deposit-failure" {...CARD_FRAME}>
            <YStack gap="$1">
              <SizableText
                size="$bodyLgMedium"
                color={failure.isCritical ? '$textCritical' : undefined}
              >
                {failure.title}
              </SizableText>
              {failure.description ? (
                <SizableText size="$bodyLg" color="$textSubdued">
                  {failure.description}
                </SizableText>
              ) : null}
            </YStack>
            <XStack gap="$2" flexWrap="wrap">
              <Button
                testID="send-binance-deposit-try-again"
                variant="primary"
                loading={isBusy}
                onPress={failure.onTryAgain}
              >
                {intl.formatMessage({ id: ETranslations.global_try_again })}
              </Button>
              <Button
                testID="send-binance-deposit-failure-exit"
                variant="secondary"
                onPress={onExit}
              >
                {failure.secondary}
              </Button>
            </XStack>
          </YStack>
        ) : (
          <YStack {...CARD_FRAME}>
            <XStack alignItems="center" gap="$3">
              <Image w="$8" h="$8" borderRadius="$full" source={BINANCE_LOGO} />
              <ListItem.Text
                flex={1}
                primary={copy.accountName}
                secondary={assetLabel || undefined}
              />
            </XStack>
            {body}
          </YStack>
        )}
      </YStack>
    </Animated.View>
  );
}

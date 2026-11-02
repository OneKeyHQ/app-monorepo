import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';
import { AccessibilityInfo } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import {
  Button,
  Divider,
  HeightTransition,
  Image,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { HighlightAddress } from '@onekeyhq/kit/src/components/HighlightAddress';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  MOTION_EASE_OUT,
  MOTION_ENTER_MS,
} from '@onekeyhq/kit/src/views/FiatCrypto/components/Headless/motionTokens';
import {
  EExchangeId,
  EXCHANGE_CONFIGS,
} from '@onekeyhq/shared/src/consts/exchangeConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EBinanceDepositSessionStatus } from '@onekeyhq/shared/types/binanceDeposit';
import type { IBinanceDepositSnapshot } from '@onekeyhq/shared/types/binanceDeposit';

import type { ImageSourcePropType } from 'react-native';

const BINANCE_LOGO: ImageSourcePropType = require('@onekeyhq/shared/src/assets/wallet/external/logo/logo_binance.png');
// The artwork is black to its edge, so on a dark page only a ring keeps its
// circle.
const BINANCE_LOGO_RING = {
  borderWidth: '$px',
  borderColor: '$border',
} as const;

const CARD_ENTERING = FadeIn.duration(MOTION_ENTER_MS).easing(MOTION_EASE_OUT);

// The entry and every state of the recipient card, failures included,
// share one frame: the border and corner radius of the large address input
// these replace (the entry only shows on phones). The card, which holds a
// whole step, rounds its corners further.
const CARD_FRAME = {
  p: '$4',
  gap: '$3',
  borderWidth: '$px',
  borderColor: '$borderStrong',
  borderRadius: '$3',
  borderCurve: 'continuous',
} as const;

// Fades in when offered and pushes everything below down instead of
// jumping; collapses the same way while an address is being typed. Its gap
// to the input sits inside the transition, so it collapses too.
export function BinanceDepositEntry({
  hidden,
  onPress,
  onShown,
}: {
  hidden: boolean;
  onPress: () => void;
  // Called while the entry is on screen, for the impression.
  onShown: () => void;
}) {
  const intl = useIntl();
  useEffect(() => {
    if (!hidden) {
      onShown();
    }
  }, [hidden, onShown]);
  return (
    <HeightTransition hide={hidden}>
      <ListItem
        testID="send-binance-deposit-entry"
        mx="$0"
        mt="$3"
        // The large address input's inner padding, so the logo lines up
        // with the input's text.
        px="$3.5"
        py="$3"
        gap="$3"
        drillIn
        onPress={onPress}
        borderWidth={CARD_FRAME.borderWidth}
        borderColor={CARD_FRAME.borderColor}
        borderRadius={CARD_FRAME.borderRadius}
        borderCurve={CARD_FRAME.borderCurve}
        userSelect="none"
      >
        <Image
          w="$6"
          h="$6"
          borderRadius="$full"
          {...BINANCE_LOGO_RING}
          source={BINANCE_LOGO}
        />
        <ListItem.Text
          flex={1}
          primary={intl.formatMessage({
            id: ETranslations.binance_deposit_account__title,
          })}
          primaryTextProps={{ size: '$bodyLg' }}
        />
      </ListItem>
    </HeightTransition>
  );
}

function CardMessage({
  title,
  description,
  isCritical,
}: {
  title: string;
  description?: string;
  isCritical?: boolean;
}) {
  return (
    <YStack gap="$1">
      <SizableText
        size="$bodyLgMedium"
        color={isCritical ? '$textCritical' : undefined}
      >
        {title}
      </SizableText>
      {description ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {description}
        </SizableText>
      ) : null}
    </YStack>
  );
}

// Progress takes the same title as the other states, with a spinner on its
// first line; a description lines up with the title.
function CardProgress({
  text,
  description,
}: {
  text: string;
  description?: string;
}) {
  return (
    <XStack gap="$2">
      <Stack h="$6" justifyContent="center">
        <Spinner size="small" />
      </Stack>
      <YStack flex={1} gap="$1">
        <SizableText size="$bodyLgMedium">{text}</SizableText>
        {description ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {description}
          </SizableText>
        ) : null}
      </YStack>
    </XStack>
  );
}

// Replaces the address input while the recipient is the user's Binance
// account. The address is read-only: leaving goes back to the plain input.
export function BinanceDepositRecipientCard({
  snapshot,
  isBusy,
  isOpening,
  isResuming,
  assetSymbol,
  networkName,
  onOpenBinance,
  onRetry,
  onRestart,
  onExit,
}: {
  snapshot?: IBinanceDepositSnapshot;
  isBusy: boolean;
  isOpening: boolean;
  isResuming: boolean;
  assetSymbol?: string;
  networkName?: string;
  onOpenBinance: () => void;
  onRetry: () => void;
  onRestart: () => void;
  onExit: () => void;
}) {
  const intl = useIntl();
  // What the deposit address takes: this coin, sent over this network.
  const assetLabel =
    assetSymbol && networkName
      ? intl.formatMessage(
          { id: ETranslations.binance_deposit_asset_on_network__desc },
          { symbol: assetSymbol, network: networkName },
        )
      : assetSymbol || networkName;
  const t = (id: ETranslations) => intl.formatMessage({ id });
  // No snapshot yet: the entry was just tapped and the server hasn't answered.
  const phase = snapshot?.phase ?? 'creating';
  const cancelText = intl.formatMessage({ id: ETranslations.global_cancel });

  let body: ReactNode = null;
  // Read out on iOS when it changes; Android follows the live region.
  let statusText: string | undefined;
  let failure:
    | {
        isCritical?: boolean;
        title: string;
        onTryAgain: () => void;
        secondary: string;
      }
    | undefined;
  // The line about coming back is read while Binance is still opening, so
  // the state waiting on the user only shows once the user is back. A
  // released address being picked up is only being fetched.
  let shownPhase = phase;
  if (phase === 'awaiting' && isOpening) {
    shownPhase = 'creating';
  } else if (!snapshot && isResuming) {
    shownPhase = 'confirming';
  }
  switch (shownPhase) {
    case 'creating':
      statusText = t(ETranslations.binance_deposit_opening__msg);
      body = (
        <CardProgress
          text={statusText}
          description={t(ETranslations.binance_deposit_auto_return__desc)}
        />
      );
      break;
    case 'confirming':
      statusText = t(ETranslations.binance_deposit_getting_address__msg);
      body = <CardProgress text={statusText} />;
      break;
    case 'awaiting': {
      // Confirmed in Binance, but the return never reached this phone: the
      // link can't be opened again, so only leaving is offered.
      const isUnbound =
        snapshot?.status === EBinanceDepositSessionStatus.AUTHORIZED_UNBOUND;
      statusText = t(
        isUnbound
          ? ETranslations.binance_deposit_confirmed__title
          : ETranslations.binance_deposit_confirm_in_app__title,
      );
      body = (
        <>
          <CardMessage
            title={statusText}
            description={t(
              isUnbound
                ? ETranslations.binance_deposit_not_returned__desc
                : ETranslations.binance_deposit_open_again__desc,
            )}
          />
          {isUnbound ? (
            <Button
              testID="send-binance-deposit-enter-address"
              size="large"
              onPress={onExit}
            >
              {t(ETranslations.binance_deposit_enter_address__action)}
            </Button>
          ) : (
            <Button
              testID="send-binance-deposit-open"
              size="large"
              variant="primary"
              loading={isBusy}
              onPress={onOpenBinance}
            >
              {intl.formatMessage(
                { id: ETranslations.receive_open_exchange },
                { exchange: EXCHANGE_CONFIGS[EExchangeId.Binance].name },
              )}
            </Button>
          )}
        </>
      );
      break;
    }
    case 'authorized':
      // Android reads the address through the live region; iOS hears that
      // the confirmation went through.
      statusText = t(ETranslations.binance_deposit_confirmed__title);
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
        title: t(ETranslations.binance_deposit_connect_failed__title),
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
        title: t(
          isConflict
            ? ETranslations.binance_deposit_security_failed__title
            : ETranslations.binance_deposit_address_failed__title,
        ),
        onTryAgain: onRestart,
        secondary: t(ETranslations.binance_deposit_enter_address__action),
      };
    }
  }
  if (failure) {
    statusText = failure.title;
    body = (
      <YStack gap="$3" testID="send-binance-deposit-failure">
        <CardMessage title={failure.title} isCritical={failure.isCritical} />
        <YStack gap="$2">
          <Button
            testID="send-binance-deposit-try-again"
            size="large"
            variant="primary"
            loading={isBusy}
            onPress={failure.onTryAgain}
          >
            {intl.formatMessage({ id: ETranslations.global_try_again })}
          </Button>
          <Button
            testID="send-binance-deposit-failure-exit"
            size="large"
            variant="secondary"
            onPress={onExit}
          >
            {failure.secondary}
          </Button>
        </YStack>
      </YStack>
    );
  }

  useEffect(() => {
    // iOS does not support live regions.
    if (platformEnv.isNativeIOS && statusText) {
      AccessibilityInfo.announceForAccessibility(statusText);
    }
  }, [statusText]);

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
              role="button"
              size="$bodyMd"
              color="$textSubdued"
              cursor="pointer"
              hoverStyle={{ color: '$text' }}
              // A 44pt touch target around the small label, without moving it.
              py="$3"
              my="$-3"
              px="$2"
              mx="$-2"
              onPress={onExit}
            >
              {phase === 'authorized'
                ? intl.formatMessage({ id: ETranslations.global_clear })
                : cancelText}
            </SizableText>
          )}
        </XStack>
        {/* Every state, failures included: who it goes to above, where it
            stands below. */}
        <YStack {...CARD_FRAME} borderRadius="$6">
          <XStack alignItems="center" gap="$3">
            <Image
              w="$8"
              h="$8"
              borderRadius="$full"
              {...BINANCE_LOGO_RING}
              source={BINANCE_LOGO}
            />
            <ListItem.Text
              flex={1}
              primary={t(ETranslations.binance_deposit_account__title)}
              secondary={assetLabel}
            />
          </XStack>
          {/* 1px like the card's border; the max height has to follow it.
              The body keeps the card's gap between its own parts. */}
          {body ? (
            <>
              <Divider borderBottomWidth={1} maxHeight={1} />
              <YStack gap={CARD_FRAME.gap} accessibilityLiveRegion="polite">
                {body}
              </YStack>
            </>
          ) : null}
        </YStack>
      </YStack>
    </Animated.View>
  );
}

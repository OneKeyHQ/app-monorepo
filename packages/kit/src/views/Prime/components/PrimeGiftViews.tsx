import type { ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Dialog,
  Icon,
  IconButton,
  LottieView,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { SetupCard } from '@onekeyhq/kit/src/views/Onboardingv2/components/SetupCard';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IPrimeGiftClaimResult,
  IPrimeGiftEligibility,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { getPrimeGiftDurationText } from '../hooks/primeGiftDuration';
import { PrimeBenefitsItem } from '../pages/PrimeDashboard/PrimeBenefitsList';
import { PRIME_FEATURE_INTROS } from '../pages/PrimeFeatures/primeFeatureIntroUtils';

import type { IntlShape } from 'react-intl';

// UI transplanted from yikZero/app-monorepo, commit 120881a7a66e806bbf45858e937db0402c7f7607.
// Callers supply live state and actions; layout and copy follow the original demo.

export function PrimeGiftHeader({
  title,
  onBack,
}: {
  title: string;
  onBack?: () => void;
}) {
  return (
    <XStack h={52} px="$2" alignItems="center">
      {onBack ? (
        <IconButton
          variant="tertiary"
          size="large"
          icon="ChevronLeftOutline"
          testID="prime-gift-back"
          onPress={onBack}
        />
      ) : (
        <Stack w="$10" />
      )}
      <SizableText flex={1} textAlign="center" size="$headingMd">
        {title}
      </SizableText>
      <Stack w="$10" />
    </XStack>
  );
}

function StatusCheckRow({
  done,
  title,
  status,
  testID,
}: {
  done: boolean;
  title: string;
  status: string;
  testID: string;
}) {
  return (
    <ListItem
      testID={testID}
      mx="$0"
      minHeight={44}
      py="$2"
      alignItems="flex-start"
      renderIcon={
        <Stack pt="$0.5" flexShrink={0}>
          <Icon
            name={done ? 'CheckRadioSolid' : 'CirclePlaceholderOnOutline'}
            size="$5"
            color={done ? '$brand9' : '$iconSubdued'}
          />
        </Stack>
      }
      title={title}
      titleProps={{ size: '$bodyLgMedium' }}
      subtitle={status}
      subtitleProps={{ size: '$bodyMd' }}
    />
  );
}

function openBenefits(intl: IntlShape) {
  Dialog.show({
    testID: 'prime-gift-dialog-benefits',
    title: intl.formatMessage({ id: ETranslations.prime_gift_benefits__title }),
    renderContent: (
      <ScrollView maxHeight={360}>
        {PRIME_FEATURE_INTROS.filter((feature) => !feature.isComingSoon).map(
          (feature) => (
            <PrimeBenefitsItem
              key={feature.id}
              feature={feature}
              itemProps={{ mx: 0, px: 0 }}
            />
          ),
        )}
      </ScrollView>
    ),
    onConfirmText: intl.formatMessage({
      id: ETranslations.prime_gift_back_to_claim__action,
    }),
    showCancelButton: false,
  });
}

export function PrimeGiftClaimContent({
  deviceModelName,
  giftMonths,
  giftDays,
  eligibilityStatus,
  isEligible,
  accountName,
  isAccountReady,
  isDeviceVerified = false,
  error,
  errorDescription,
}: Partial<Pick<IPrimeGiftEligibility, 'giftMonths' | 'giftDays'>> & {
  deviceModelName: string;
  eligibilityStatus: string;
  isEligible: boolean;
  accountName?: string;
  isAccountReady: boolean;
  isDeviceVerified?: boolean;
  error?: string;
  errorDescription?: string;
}) {
  const intl = useIntl();
  const giftDuration = getPrimeGiftDurationText({ giftMonths, giftDays }, intl);
  const icon =
    useThemeName() === 'light'
      ? 'OnekeyPrimeLightColored'
      : 'OnekeyPrimeDarkColored';
  return (
    <YStack px="$5" pb="$5" gap="$5" testID="prime-gift-claim-content">
      <YStack alignItems="center" gap="$2" pt="$2">
        <Icon name={icon} size="$12" />
        <SizableText size="$heading2xl" textAlign="center">
          {giftDuration
            ? intl.formatMessage(
                { id: ETranslations.prime_gift_claim_duration__action },
                { duration: giftDuration },
              )
            : intl.formatMessage({ id: ETranslations.prime_gift__title })}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {intl.formatMessage(
            { id: ETranslations.prime_gift_thanks__desc },
            { deviceName: deviceModelName },
          )}
        </SizableText>
        <Button
          variant="tertiary"
          size="small"
          minHeight={44}
          iconAfter="ChevronRightSmallOutline"
          testID="prime-gift-open-benefits"
          onPress={() => openBenefits(intl)}
        >
          {intl.formatMessage({
            id: ETranslations.prime_gift_benefits__action,
          })}
        </Button>
      </YStack>
      <SetupCard elevated={false}>
        <YStack bg="$bgSubdued" borderRadius="$4" overflow="hidden" py="$1">
          <StatusCheckRow
            testID="prime-gift-check-account"
            done={isAccountReady}
            title={intl.formatMessage({
              id: ETranslations.sign_in_to_onekey_id__title,
            })}
            status={
              isAccountReady && accountName
                ? accountName
                : intl.formatMessage({
                    id: ETranslations.prime_gift_account__desc,
                  })
            }
          />
          <StatusCheckRow
            testID="prime-gift-check-device"
            done={isDeviceVerified}
            title={intl.formatMessage({
              id: ETranslations.prime_gift_verify__title,
            })}
            status={intl.formatMessage({
              id: isDeviceVerified
                ? ETranslations.prime_gift_verified__desc
                : ETranslations.prime_gift_verify__desc,
            })}
          />
          <StatusCheckRow
            testID="prime-gift-check-eligibility"
            done={isDeviceVerified && isEligible}
            title={intl.formatMessage({
              id: ETranslations.prime_gift_eligibility__title,
            })}
            status={
              isDeviceVerified
                ? eligibilityStatus
                : intl.formatMessage({
                    id: ETranslations.prime_gift_eligibility_pending__desc,
                  })
            }
          />
        </YStack>
      </SetupCard>
      {error ? (
        <Alert
          type="critical"
          title={error}
          testID="prime-gift-error"
          description={errorDescription}
        />
      ) : null}
    </YStack>
  );
}

export function PrimeGiftClaimFooter({
  primaryLabel,
  isProcessing,
  onSubmit,
}: {
  primaryLabel: string;
  isProcessing: boolean;
  onSubmit: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack px="$5" pt="$3" pb="$5" gap="$3" flexShrink={0}>
      <SizableText size="$bodySm" color="$textSubdued" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.prime_gift_eligible_device_once__desc,
        })}
      </SizableText>
      <Button
        size="large"
        variant="primary"
        loading={isProcessing}
        disabled={isProcessing}
        testID="prime-gift-claim-primary"
        onPress={onSubmit}
      >
        {primaryLabel}
      </Button>
    </YStack>
  );
}

export function PrimeGiftSuccessContent({
  result,
  isKytEnabled,
  isKytLoading,
  isNotificationEnabled = false,
  onKyt,
}: {
  result: IPrimeGiftClaimResult;
  isKytEnabled: boolean;
  isKytLoading: boolean;
  isNotificationEnabled?: boolean;
  onKyt: () => void;
}) {
  const intl = useIntl();
  const icon =
    useThemeName() === 'light'
      ? 'OnekeyPrimeLightColored'
      : 'OnekeyPrimeDarkColored';
  return (
    <YStack flex={1} px="$5" py="$4" testID="prime-gift-success">
      <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
        <LottieView
          source={require('@onekeyhq/kit/assets/animations/lottie-swap-done.json')}
          width={96}
          height={96}
          autoPlay
          loop={false}
        />
        <SizableText size="$heading3xl" textAlign="center">
          {intl.formatMessage({ id: ETranslations.prime_gift_success__title })}
        </SizableText>
        <YStack alignItems="center" gap="$2">
          <XStack alignItems="center" gap="$1.5">
            <Icon name={icon} size="$5" />
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage(
                { id: ETranslations.prime_gift_duration__desc },
                {
                  duration: getPrimeGiftDurationText(
                    {
                      giftMonths: result.giftMonths,
                      giftDays: result.addedDays,
                    },
                    intl,
                  ),
                },
              )}
            </SizableText>
          </XStack>
          <YStack alignItems="center" gap="$0.5">
            <SizableText size="$bodyMd" color="$textSubdued">
              {result.email || result.onekeyUserId}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage(
                { id: ETranslations.prime_membership_valid_until__desc },
                { date: formatDateFns(new Date(result.finalExpiresAt), 'PP') },
              )}
            </SizableText>
          </YStack>
        </YStack>
      </YStack>
      {isKytEnabled ? (
        <YStack mt="$4" width="100%" bg="$bgSubdued" borderRadius="$4" p="$4">
          <XStack alignItems="flex-start" gap="$3">
            <Icon
              name="CheckRadioSolid"
              size="$5"
              color="$brand9"
              flexShrink={0}
              pt="$0.5"
            />
            <YStack flex={1} minWidth={0} gap="$1">
              <SizableText size="$bodyLgMedium">
                {intl.formatMessage({
                  id: ETranslations.prime_gift_kyt_enabled__title,
                })}
              </SizableText>
              <SizableText size="$bodyMd" color="$textSubdued">
                {intl.formatMessage({
                  id: isNotificationEnabled
                    ? ETranslations.prime_gift_kyt_notifications__desc
                    : ETranslations.prime_gift_kyt_history__desc,
                })}
              </SizableText>
            </YStack>
          </XStack>
        </YStack>
      ) : (
        <XStack
          mt="$4"
          width="100%"
          minHeight={44}
          bg="$bgSubdued"
          borderRadius="$4"
          p="$4"
          alignItems="center"
          gap="$3"
          accessibilityRole="button"
          focusable
          testID="prime-gift-open-kyt"
          onPress={isKytLoading ? undefined : onKyt}
          hoverStyle={{ bg: '$bgHover' }}
          pressStyle={{ bg: '$bgActive' }}
        >
          <Icon
            name="ShieldOutline"
            size="$5"
            color="$iconSubdued"
            flexShrink={0}
          />
          <YStack flex={1} minWidth={0} gap="$0.5">
            <SizableText size="$bodyLgMedium">
              {intl.formatMessage({
                id: ETranslations.prime_feature_receive_risk_monitoring__title,
              })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.prime_gift_kyt__desc })}
            </SizableText>
          </YStack>
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
            flexShrink={0}
          />
        </XStack>
      )}
    </YStack>
  );
}

export function PrimeGiftClaimView({
  onBack,
  primaryLabel,
  isProcessing,
  onSubmit,
  ...contentProps
}: ComponentProps<typeof PrimeGiftClaimContent> &
  ComponentProps<typeof PrimeGiftClaimFooter> & { onBack: () => void }) {
  const intl = useIntl();
  return (
    <YStack flex={1}>
      <PrimeGiftHeader
        title={intl.formatMessage({ id: ETranslations.prime_gift__title })}
        onBack={onBack}
      />
      <ScrollView flex={1}>
        <PrimeGiftClaimContent {...contentProps} />
      </ScrollView>
      <PrimeGiftClaimFooter
        primaryLabel={primaryLabel}
        isProcessing={isProcessing}
        onSubmit={onSubmit}
      />
    </YStack>
  );
}

export function PrimeGiftSuccessView({
  onEnterWallet,
  ...contentProps
}: ComponentProps<typeof PrimeGiftSuccessContent> & {
  onEnterWallet: () => void;
}) {
  const intl = useIntl();
  return (
    <YStack flex={1}>
      <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
        <PrimeGiftSuccessContent {...contentProps} />
      </ScrollView>
      <YStack px="$5" pb="$5">
        <Button
          size="large"
          variant="primary"
          testID="prime-gift-enter-wallet"
          onPress={onEnterWallet}
        >
          {intl.formatMessage({ id: ETranslations.enter_wallet })}
        </Button>
      </YStack>
    </YStack>
  );
}

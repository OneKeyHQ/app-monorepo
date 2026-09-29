import { type ComponentProps, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Dialog,
  Icon,
  LottieView,
  Page,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
  useThemeName,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import type {
  IPrimeGiftClaimResult,
  IPrimeGiftEligibility,
} from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { getPrimeGiftDurationText } from '../hooks/primeGiftDuration';
import { PrimeBenefitsItem } from '../pages/PrimeDashboard/PrimeBenefitsList';
import { PRIME_FEATURE_INTROS } from '../pages/PrimeFeatures/primeFeatureIntroUtils';

import { PrimeDarkDialogContainer } from './PrimeDarkDialogContainer';
import { PrimeGiftCampaignBanner } from './PrimeGiftCampaignBanner';

import type { IntlShape } from 'react-intl';

// UI transplanted from yikZero/app-monorepo, commit 120881a7a66e806bbf45858e937db0402c7f7607.
// Callers supply live state and actions; layout and copy follow the original demo.

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

function EligibilityCodeRow({
  done,
  title,
  status,
  code,
  onViewCode,
  onCopyCode,
}: {
  done: boolean;
  title: string;
  status: string;
  code?: string;
  onViewCode?: () => void;
  onCopyCode?: () => void;
}) {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    setIsVisible(false);
  }, [code]);
  return (
    <YStack>
      <StatusCheckRow
        testID="prime-gift-check-eligibility"
        done={done}
        title={title}
        status={status}
      />
      {code ? (
        // ListItem text starts after px $3 + icon $5 + gap $3.
        <YStack pl="$11" pr="$3" pb="$3" gap="$2">
          <Button
            variant="tertiary"
            size="small"
            alignSelf="flex-start"
            maxWidth="100%"
            minHeight={platformEnv.isNative ? 44 : undefined}
            height="auto"
            iconAfter={
              isVisible ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'
            }
            aria-expanded={isVisible}
            testID="prime-gift-view-code"
            onPress={() => {
              if (!isVisible) onViewCode?.();
              setIsVisible((visible) => !visible);
            }}
          >
            {intl.formatMessage({
              id: isVisible
                ? ETranslations.global_collapse
                : ETranslations.prime_gift_view_code__action,
            })}
          </Button>
          {isVisible ? (
            <XStack
              px="$3"
              py="$2.5"
              bg="$bgApp"
              borderRadius="$3"
              alignItems="center"
              gap="$2"
            >
              <SizableText
                flex={1}
                minWidth={0}
                size="$bodyLgMedium"
                fontFamily="$monoMedium"
                testID="prime-gift-redemption-code"
                style={
                  platformEnv.isNative ? undefined : { wordBreak: 'break-all' }
                }
              >
                {code}
              </SizableText>
              <Button
                variant="tertiary"
                size="small"
                flexShrink={0}
                testID="prime-gift-copy-code"
                onPress={() => {
                  copyText(code);
                  onCopyCode?.();
                }}
              >
                {intl.formatMessage({ id: ETranslations.global_copy })}
              </Button>
            </XStack>
          ) : null}
        </YStack>
      ) : null}
    </YStack>
  );
}

function openBenefits(intl: IntlShape) {
  Dialog.show({
    dialogContainer: ({ ref }) => (
      <PrimeDarkDialogContainer
        ref={ref}
        testID="prime-gift-dialog-benefits"
        title={intl.formatMessage({
          id: ETranslations.prime_gift_benefits__title,
        })}
        renderContent={
          <ScrollView maxHeight={360}>
            {PRIME_FEATURE_INTROS.filter(
              (feature) => !feature.isComingSoon,
            ).map((feature) => (
              <PrimeBenefitsItem
                key={feature.id}
                feature={feature}
                itemProps={{ mx: 0, px: 0 }}
              />
            ))}
          </ScrollView>
        }
        onConfirmText={intl.formatMessage({
          id: ETranslations.prime_gift_back_to_claim__action,
        })}
        showCancelButton={false}
        onClose={async () => undefined}
      />
    ),
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
  redemptionCode,
  onViewCode,
  onCopyCode,
  isPendingPaymentConfirm = false,
  error,
  errorDescription,
}: Partial<Pick<IPrimeGiftEligibility, 'giftMonths' | 'giftDays'>> & {
  deviceModelName: string;
  eligibilityStatus: string;
  isEligible: boolean;
  accountName?: string;
  isAccountReady: boolean;
  isDeviceVerified?: boolean;
  redemptionCode?: string;
  onViewCode?: () => void;
  onCopyCode?: () => void;
  isPendingPaymentConfirm?: boolean;
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
        <EligibilityCodeRow
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
          code={redemptionCode}
          onViewCode={onViewCode}
          onCopyCode={onCopyCode}
        />
      </YStack>
      {isPendingPaymentConfirm ? (
        <Alert
          type="warning"
          testID="prime-gift-pending-payment"
          title={intl.formatMessage({
            id: ETranslations.prime_redeem_pending_payment__title,
          })}
          description={intl.formatMessage({
            id: ETranslations.prime_redeem_pending_payment__desc,
          })}
        />
      ) : null}
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
    <Page.Footer>
      <Page.FooterActions
        onConfirm={() => {
          onSubmit();
        }}
        onConfirmText={primaryLabel}
        confirmButtonProps={{
          loading: isProcessing,
          disabled: isProcessing,
          testID: 'prime-gift-claim-primary',
        }}
      >
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          $md={{ mb: '$2', textAlign: 'center' }}
        >
          {intl.formatMessage({
            id: ETranslations.prime_gift_eligible_device_once__desc,
          })}
        </SizableText>
      </Page.FooterActions>
    </Page.Footer>
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
        <YStack alignItems="center" gap="$0.5">
          <SizableText size="$bodyMd" color="$textSubdued">
            {result.email || result.onekeyUserId}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage(
              { id: ETranslations.prime_gift_valid_until__desc },
              { date: formatDateFns(new Date(result.finalExpiresAt), 'PP') },
            )}
          </SizableText>
        </YStack>
      </YStack>
      <PrimeGiftCampaignBanner />
      {isKytEnabled ? (
        <YStack
          mt="$4"
          width="100%"
          bg="$bgSubdued"
          borderWidth={1}
          borderColor="$neutral3"
          borderRadius="$4"
          p="$4"
        >
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
          borderWidth={1}
          borderColor="$neutral3"
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
  primaryLabel,
  isProcessing,
  onSubmit,
  ...contentProps
}: ComponentProps<typeof PrimeGiftClaimContent> &
  ComponentProps<typeof PrimeGiftClaimFooter>) {
  return (
    <YStack flex={1}>
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
  confirmLabel,
  onConfirm,
  ...contentProps
}: ComponentProps<typeof PrimeGiftSuccessContent> & {
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <YStack flex={1}>
      <ScrollView flex={1} contentContainerStyle={{ flexGrow: 1 }}>
        <PrimeGiftSuccessContent {...contentProps} />
      </ScrollView>
      <Page.Footer>
        <Page.FooterActions
          onConfirm={onConfirm}
          onConfirmText={confirmLabel}
          confirmButtonProps={{
            testID: 'prime-gift-enter-wallet',
          }}
        />
      </Page.Footer>
    </YStack>
  );
}

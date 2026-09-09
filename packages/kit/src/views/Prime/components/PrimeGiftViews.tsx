import { useIntl } from 'react-intl';

import {
  Alert,
  Button,
  Dialog,
  Icon,
  LottieView,
  ScrollView,
  SizableText,
  XStack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IPrimeGiftClaimResult } from '@onekeyhq/shared/types/prime/primeGiftTypes';

import { usePrimeGiftMessages } from '../hooks/usePrimeGiftMessages';
import { PRIME_FEATURE_INTROS } from '../pages/PrimeFeatures/primeFeatureIntroUtils';

function PrimeGiftStatusRow({
  title,
  status,
  done,
  onPress,
}: {
  title: string;
  status: string;
  done: boolean;
  onPress?: () => void;
}) {
  return (
    <ListItem
      mx="$0"
      minHeight={72}
      py="$3"
      alignItems="flex-start"
      onPress={onPress}
      drillIn={Boolean(onPress)}
      renderIcon={
        <Icon
          name={done ? 'CheckRadioSolid' : 'CirclePlaceholderOnOutline'}
          size="$5"
          color={done ? '$brand9' : '$iconSubdued'}
          mt="$0.5"
        />
      }
      title={title}
      titleProps={{ size: '$bodyLgMedium' }}
      subtitle={status}
      subtitleProps={{ size: '$bodyMd' }}
    />
  );
}

function PrimeGiftBenefits() {
  const intl = useIntl();
  return (
    <ScrollView maxHeight={440}>
      <YStack gap="$4" py="$2">
        {PRIME_FEATURE_INTROS.filter((feature) => !feature.isComingSoon).map(
          (feature) => (
            <XStack key={feature.id} gap="$3" alignItems="flex-start">
              <YStack p="$2" bg="$brand4" borderRadius="$3">
                <Icon name={feature.listIcon} size="$6" color="$brand9" />
              </YStack>
              <YStack flex={1} gap="$1">
                <SizableText size="$bodyLgMedium">
                  {intl.formatMessage({ id: feature.title })}
                </SizableText>
                <SizableText size="$bodyMd" color="$textSubdued">
                  {intl.formatMessage(
                    { id: feature.description },
                    feature.descriptionValues,
                  )}
                </SizableText>
              </YStack>
            </XStack>
          ),
        )}
      </YStack>
    </ScrollView>
  );
}

export function PrimeGiftClaimContent({
  giftMonths,
  eligibilityStatus,
  isEligible,
  accountName,
  isAccountReady,
  isProcessing,
  isDeviceVerified = false,
  error,
  onAccount,
}: {
  giftMonths?: number;
  eligibilityStatus: string;
  isEligible: boolean;
  accountName?: string;
  isAccountReady: boolean;
  isProcessing: boolean;
  isDeviceVerified?: boolean;
  error?: string;
  onAccount?: () => void;
}) {
  const message = usePrimeGiftMessages();
  const theme = useThemeName();
  let verificationStatus = ETranslationsMock.prime_gift_verify_desc;
  if (isProcessing)
    verificationStatus = ETranslationsMock.prime_gift_processing;
  else if (isDeviceVerified)
    verificationStatus = ETranslationsMock.prime_gift_verified;
  return (
    <YStack px="$5" pb="$5" gap="$5" testID="pro2-prime-claim-content">
      <YStack alignItems="center" gap="$2" pt="$2">
        <Icon
          name={
            theme === 'light'
              ? 'OnekeyPrimeLightColored'
              : 'OnekeyPrimeDarkColored'
          }
          size="$12"
        />
        <SizableText size="$heading2xl" textAlign="center">
          {giftMonths
            ? message(ETranslationsMock.prime_gift_claim, { count: giftMonths })
            : message(ETranslationsMock.prime_gift_title)}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {message(ETranslationsMock.prime_gift_thanks)}
        </SizableText>
        <Button
          variant="tertiary"
          size="small"
          minHeight={44}
          iconAfter="ChevronRightSmallOutline"
          testID="pro2-prime-open-benefits"
          onPress={() =>
            Dialog.show({
              title: message(ETranslationsMock.prime_gift_benefits),
              renderContent: <PrimeGiftBenefits />,
              showFooter: false,
            })
          }
        >
          {message(ETranslationsMock.prime_gift_benefits)}
        </Button>
      </YStack>
      <YStack bg="$bgSubdued" borderRadius="$4" overflow="hidden" py="$1">
        <PrimeGiftStatusRow
          done={isEligible}
          title={message(ETranslationsMock.prime_gift_eligibility)}
          status={eligibilityStatus}
        />
        <PrimeGiftStatusRow
          done={isAccountReady}
          title={message(ETranslationsMock.prime_gift_account)}
          status={
            accountName || message(ETranslationsMock.prime_gift_account_desc)
          }
          onPress={onAccount}
        />
        <PrimeGiftStatusRow
          done={isDeviceVerified}
          title={message(ETranslationsMock.prime_gift_verify)}
          status={message(verificationStatus)}
        />
      </YStack>
      {error ? (
        <Alert type="critical" title={error} testID="pro2-prime-error" />
      ) : null}
    </YStack>
  );
}

export function PrimeGiftSuccessContent({
  result,
  isKytEnabled,
  isKytLoading,
  onKyt,
}: {
  result: IPrimeGiftClaimResult;
  isKytEnabled: boolean;
  isKytLoading: boolean;
  onKyt: () => void;
}) {
  const intl = useIntl();
  const message = usePrimeGiftMessages();
  const theme = useThemeName();
  return (
    <YStack
      flex={1}
      px="$5"
      py="$4"
      minHeight={360}
      testID="pro2-prime-success"
    >
      <YStack
        flex={1}
        justifyContent="center"
        alignItems="center"
        gap="$3"
        py="$6"
      >
        <LottieView
          source={require('@onekeyhq/kit/assets/animations/lottie-swap-done.json')}
          width={96}
          height={96}
          autoPlay
          loop={false}
        />
        <SizableText size="$heading3xl" textAlign="center">
          {message(ETranslationsMock.prime_gift_success)}
        </SizableText>
        <YStack alignItems="center" gap="$2">
          <XStack alignItems="center" gap="$1.5">
            <Icon
              name={
                theme === 'light'
                  ? 'OnekeyPrimeLightColored'
                  : 'OnekeyPrimeDarkColored'
              }
              size="$5"
            />
            <SizableText size="$bodyLgMedium">
              {message(ETranslationsMock.prime_gift_months, {
                count: result.giftMonths,
              })}
            </SizableText>
          </XStack>
          <SizableText
            size="$bodyMd"
            color="$textSubdued"
            textAlign="center"
            testID="pro2-prime-success-account"
          >
            {result.email || result.onekeyUserId}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
            {intl.formatMessage(
              { id: ETranslations.prime_membership_valid_until__desc },
              { date: formatDateFns(new Date(result.finalExpiresAt)) },
            )}
          </SizableText>
        </YStack>
      </YStack>
      <XStack
        mt="$4"
        width="100%"
        minHeight={72}
        bg="$bgSubdued"
        borderRadius="$4"
        p="$4"
        alignItems="center"
        gap="$3"
        accessibilityRole={isKytEnabled ? undefined : 'button'}
        focusable={!isKytEnabled && !isKytLoading}
        testID="pro2-prime-open-kyt"
        onPress={isKytEnabled || isKytLoading ? undefined : onKyt}
        opacity={isKytLoading ? 0.5 : 1}
      >
        <Icon
          name={isKytEnabled ? 'CheckRadioSolid' : 'ShieldOutline'}
          size="$5"
          color={isKytEnabled ? '$brand9' : '$iconSubdued'}
        />
        <YStack flex={1} minWidth={0} gap="$0.5">
          <SizableText size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.prime_feature_receive_risk_monitoring__title,
            })}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: isKytEnabled
                ? ETranslations.global_enabled
                : ETranslations.prime_feature_receive_risk_monitoring__desc,
            })}
          </SizableText>
        </YStack>
        {isKytEnabled ? null : (
          <Icon
            name="ChevronRightSmallOutline"
            size="$5"
            color="$iconSubdued"
          />
        )}
      </XStack>
    </YStack>
  );
}

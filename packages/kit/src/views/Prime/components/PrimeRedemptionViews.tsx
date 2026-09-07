import type { ReactNode } from 'react';

import { useIntl } from 'react-intl';

import type { IKeyOfIcons } from '@onekeyhq/components';
import {
  Form,
  Icon,
  Input,
  LottieView,
  SizableText,
  Stack,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import type { UseFormReturn } from '@onekeyhq/components/src/hooks/useForm';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IPrimeRedemptionResult } from '@onekeyhq/shared/types/prime/primeTypes';

import { PrimeTestIDs } from '../testIDs';

import type { IPrimeRedemptionFormValues } from '../hooks/usePrimeRedemptionSubmit';

function usePrimeRedemptionIconName() {
  const themeName = useThemeName();
  return themeName === 'light'
    ? 'OnekeyPrimeLightColored'
    : 'OnekeyPrimeDarkColored';
}

function PrimeRedemptionSuccessSummary({
  primeIconName,
  receivedDaysMessage,
  validUntilMessage,
}: {
  primeIconName: IKeyOfIcons;
  receivedDaysMessage: string;
  validUntilMessage: string;
}) {
  return (
    <YStack
      mt="$5"
      width="100%"
      alignItems="center"
      bg="$brand2"
      borderRadius="$3"
      borderCurve="continuous"
      borderWidth="$px"
      borderColor="$brand4"
      overflow="hidden"
    >
      <Stack w="100%" h="$1" bg="$brand5" />
      <YStack px="$4" py="$4" gap="$1.5" alignItems="center" width="100%">
        <Icon name={primeIconName} size="$6" />
        <SizableText size="$headingMd" textAlign="center">
          {receivedDaysMessage}
        </SizableText>
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {validUntilMessage}
        </SizableText>
      </YStack>
    </YStack>
  );
}

export function PrimeRedemptionFormView({
  accountSlot,
  form,
}: {
  accountSlot?: ReactNode;
  form: UseFormReturn<IPrimeRedemptionFormValues>;
}) {
  const intl = useIntl();
  const primeIconName = usePrimeRedemptionIconName();
  const redemptionCodeLabel = intl.formatMessage({
    id: ETranslations.redemption_enter_code_placeholder,
  });

  return (
    <YStack alignItems="center" width="100%" gap="$5">
      <Icon name={primeIconName} size="$12" />
      <SizableText size="$headingXl" textAlign="center">
        {intl.formatMessage({
          id: ETranslations.prime_redeem__action,
        })}
      </SizableText>
      {accountSlot}
      <YStack width="100%">
        <Form form={form}>
          <Form.Field
            name="code"
            errorMessagePaddingHorizontal={15}
            description={
              <YStack
                width="100%"
                mt="$3"
                p="$3.5"
                gap="$2"
                bg="$bgSubdued"
                borderRadius="$3"
              >
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.prime_redemption_codes_cumulative__desc,
                  })}
                </SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.prime_redemption_paid_subscription_blocked__desc,
                  })}
                </SizableText>
              </YStack>
            }
          >
            <Input
              testID={PrimeTestIDs.redemptionCodeInput}
              size="large"
              accessibilityLabel={redemptionCodeLabel}
              placeholder={redemptionCodeLabel}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </Form.Field>
        </Form>
      </YStack>
    </YStack>
  );
}

export function PrimeRedemptionSuccessView({
  redemptionResult,
}: {
  redemptionResult: IPrimeRedemptionResult;
}) {
  const intl = useIntl();
  const primeIconName = usePrimeRedemptionIconName();
  const successTitle = intl.formatMessage({
    id: ETranslations.redemption_success_title,
  });
  const receivedDaysMessage = intl.formatMessage(
    {
      id: ETranslations.prime_redemption_received_days__msg,
    },
    { count: redemptionResult.addedDays },
  );
  const validUntilMessage = intl.formatMessage(
    {
      id: ETranslations.prime_membership_valid_until__desc,
    },
    {
      date: formatDateFns(new Date(redemptionResult.finalExpiresAt)),
    },
  );

  return (
    <YStack
      alignItems="center"
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${successTitle} ${receivedDaysMessage} ${validUntilMessage}`}
    >
      <LottieView
        source={require('@onekeyhq/kit/assets/animations/lottie-swap-done.json')}
        width={110}
        height={110}
        autoPlay
        loop={false}
      />
      <SizableText size="$headingXl" textAlign="center" mt="$-2">
        {successTitle}
      </SizableText>
      <PrimeRedemptionSuccessSummary
        primeIconName={primeIconName}
        receivedDaysMessage={receivedDaysMessage}
        validUntilMessage={validUntilMessage}
      />
    </YStack>
  );
}

import { useIntl } from 'react-intl';

import {
  Form,
  Icon,
  Input,
  LottieView,
  SizableText,
  Stack,
  UnOrderedList,
  YStack,
  useThemeName,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatDateFns } from '@onekeyhq/shared/src/utils/dateUtils';
import type { IPrimeRedemptionResult } from '@onekeyhq/shared/types/prime/primeTypes';

import { PrimeTestIDs } from '../testIDs';

import type { IPrimeRedemptionSubmit } from '../hooks/usePrimeRedemptionSubmit';

export function usePrimeRedemptionIconName() {
  const themeName = useThemeName() as 'light' | 'dark';
  return themeName === 'light'
    ? 'OnekeyPrimeLightColored'
    : 'OnekeyPrimeDarkColored';
}

export function PrimeRedemptionFormView({
  form,
}: {
  form: IPrimeRedemptionSubmit['form'];
}) {
  const intl = useIntl();
  const primeIconName = usePrimeRedemptionIconName();
  const redemptionCodeLabel = intl.formatMessage({
    id: ETranslations.redemption_enter_code_placeholder,
  });

  return (
    <YStack alignItems="center">
      <Stack
        w="$16"
        h="$16"
        bg="$brand3"
        borderRadius="$full"
        alignItems="center"
        justifyContent="center"
        mb="$5"
      >
        <Icon name={primeIconName} size="$10" />
      </Stack>
      <SizableText size="$headingXl" textAlign="center" mb="$5">
        {intl.formatMessage({
          id: ETranslations.prime_redeem__action,
        })}
      </SizableText>
      <YStack width="100%">
        <Form form={form}>
          <Form.Field
            name="code"
            description={
              <UnOrderedList width="100%" pt="$2">
                <UnOrderedList.Item titleSize="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.prime_redemption_codes_cumulative__desc,
                  })}
                </UnOrderedList.Item>
                <UnOrderedList.Item titleSize="$bodySm" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.prime_redemption_paid_subscription_blocked__desc,
                  })}
                </UnOrderedList.Item>
              </UnOrderedList>
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
      <YStack
        mt="$5"
        width="100%"
        px="$4"
        py="$4"
        gap="$1.5"
        alignItems="center"
        bg="$brand2"
        borderRadius="$3"
        borderCurve="continuous"
      >
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

import { useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { getPrimePackagesFailureDescriptionId } from '../../hooks/primePackagesFetchFailure';

import type { IPrimePackagesFetchFailure } from '../../hooks/primePackagesFetchFailure';

export function PrimePackagesFetchFailed({
  failure,
  canPurchaseWithoutPackages,
  onRetry,
}: {
  failure: IPrimePackagesFetchFailure;
  // The footer Subscribe button stays enabled for card or crypto checkout.
  canPurchaseWithoutPackages: boolean;
  onRetry: () => Promise<void>;
}) {
  const intl = useIntl();
  const descriptionId = getPrimePackagesFailureDescriptionId(failure);
  const { kind, storefrontCountryCode } = failure;

  useEffect(() => {
    defaultLogger.prime.subscription.primePackagesFailStateShow({
      failureKind: kind,
      storefrontCountryCode,
      canPurchaseWithoutPackages,
    });
  }, [kind, canPurchaseWithoutPackages, storefrontCountryCode]);

  return (
    // Sits where the plan cards would be and matches their surface, so the
    // page keeps its layout and the benefits list stays in view.
    <YStack
      gap="$3"
      px="$3.5"
      py="$3"
      bg="$bg"
      borderWidth={1}
      borderColor="$borderSubdued"
      borderRadius="$3"
      borderCurve="continuous"
      testID="prime-packages-fetch-failed"
    >
      <YStack gap="$1">
        <SizableText size="$headingMd">
          {intl.formatMessage({
            id: ETranslations.prime_plans_unavailable__title,
          })}
        </SizableText>
        {descriptionId ? (
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({ id: descriptionId })}
          </SizableText>
        ) : null}
      </YStack>
      <Button
        alignSelf="flex-start"
        size="small"
        variant="secondary"
        testID="prime-packages-fetch-retry"
        onPress={async () => {
          defaultLogger.prime.subscription.primePackagesFailStateAction({
            failureKind: kind,
            action: 'retry',
          });
          await onRetry();
        }}
      >
        {intl.formatMessage({ id: ETranslations.global_retry })}
      </Button>
    </YStack>
  );
}

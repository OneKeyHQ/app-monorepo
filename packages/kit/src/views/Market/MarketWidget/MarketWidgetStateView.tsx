import { useIntl } from 'react-intl';

import { Empty, Spinner, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useMarketWidgetCopy } from './useMarketWidgetCopy';

export function MarketWidgetStateView({
  privacyMasked,
  isLoading,
  hasError = false,
  onRetry,
  unavailable = false,
}: {
  privacyMasked: boolean;
  isLoading: boolean;
  hasError?: boolean;
  onRetry: () => Promise<void>;
  unavailable?: boolean;
}) {
  const intl = useIntl();
  const copy = useMarketWidgetCopy();
  let title = intl.formatMessage({
    id: ETranslations.global_an_error_occurred,
  });
  if (privacyMasked) title = copy.privacyUnavailable;
  else if (unavailable) title = copy.unavailableConfiguration;
  if (!privacyMasked && !unavailable && (isLoading || !hasError)) {
    return (
      <YStack
        flex={1}
        minHeight="$48"
        justifyContent="center"
        alignItems="center"
      >
        <Spinner size="large" />
      </YStack>
    );
  }
  return (
    <Empty
      flex={1}
      icon={privacyMasked ? 'EyeOffOutline' : 'ErrorOutline'}
      title={title}
      buttonProps={
        privacyMasked || unavailable
          ? undefined
          : {
              testID: 'market-widget-retry',
              children: intl.formatMessage({ id: ETranslations.global_retry }),
              onPress: onRetry,
            }
      }
    />
  );
}

import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Button } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IPortfolioSyncButtonState = 'idle' | 'loading' | 'success';

function BasicPortfolioSyncButton({
  disabled,
  onPress,
  state,
}: {
  disabled?: boolean;
  onPress: () => void;
  state: IPortfolioSyncButtonState;
}) {
  const intl = useIntl();
  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  let label = ETranslations.portfolio_sync_to_device__action;
  if (isLoading) {
    label = ETranslations.global_syncing;
  } else if (isSuccess) {
    label = ETranslations.global_synced;
  }

  return (
    <Button
      testID="home-sync-portfolio"
      variant="secondary"
      size="small"
      icon={isSuccess ? 'CheckRadioSolid' : 'OnekeyDeviceCustom'}
      iconColor={isSuccess ? '$iconSuccess' : undefined}
      color={isSuccess ? '$textSuccess' : undefined}
      onPress={onPress}
      disabled={disabled || isLoading || isSuccess}
      loading={isLoading}
      opacity={isLoading || isSuccess ? 1 : undefined}
      accessibilityLiveRegion="polite"
    >
      {intl.formatMessage({ id: label })}
    </Button>
  );
}

export const PortfolioSyncButton = memo(BasicPortfolioSyncButton);

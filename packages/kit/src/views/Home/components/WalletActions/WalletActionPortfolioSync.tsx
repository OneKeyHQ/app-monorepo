import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import { usePortfolioSyncUiStateAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { HomeTestIDs } from '../../testIDs';

export function WalletActionPortfolioSync({
  onClose,
}: {
  onClose: () => void;
}) {
  const intl = useIntl();
  const [portfolioSyncUiState] = usePortfolioSyncUiStateAtom();
  const { disabled, request, visible } = portfolioSyncUiState;

  const handlePress = useCallback(
    (close: () => void) => {
      close();
      request?.();
    },
    [request],
  );

  if (!visible) {
    return null;
  }

  return (
    <ActionList.Item
      testID={HomeTestIDs.portfolioUpdateAction}
      trackID="wallet-action-update-portfolio"
      icon="OnekeyDeviceCustom"
      label={intl.formatMessage({
        id: ETranslations.portfolio_sync_to_device__action,
      })}
      disabled={disabled}
      onClose={onClose}
      onPress={handlePress}
    />
  );
}

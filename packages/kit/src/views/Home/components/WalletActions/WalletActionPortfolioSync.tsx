import { useCallback, useContext } from 'react';

import { useIntl } from 'react-intl';

import { ActionList, runAfterActionListClose } from '@onekeyhq/components';
import { usePortfolioSyncUiStateAtom } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

import { HomeTestIDs } from '../../testIDs';
import { HomeStickyHeaderContext } from '../HomeStickyHeaderContext';

export function WalletActionPortfolioSync({
  onClose,
}: {
  onClose: () => void;
}) {
  const intl = useIntl();
  const activeTabId = useContext(HomeStickyHeaderContext)?.activeTabId;
  const [portfolioSyncUiState] = usePortfolioSyncUiStateAtom();
  const { disabled, request, visible } = portfolioSyncUiState;

  const handlePress = useCallback(
    (close: () => void) => {
      void runAfterActionListClose(close, () => request?.());
    },
    [request],
  );

  if (!visible || activeTabId !== EHomeWalletTab.Portfolio) {
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

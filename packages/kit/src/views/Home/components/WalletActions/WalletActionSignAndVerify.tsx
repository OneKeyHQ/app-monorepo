import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalSignAndVerifyRoutes } from '@onekeyhq/shared/src/routes/signAndVerify';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

export function WalletActionSignAndVerify({
  onClose,
}: {
  onClose: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const {
    network,
    account,
    wallet,
    indexedAccount,
    deriveInfoItems,
    deriveType,
    isOthersWallet,
  } = activeAccount;

  const handleSignAndVerify = useCallback(async () => {
    if (!network?.id || !wallet?.id) {
      return;
    }
    navigation.pushModal(EModalRoutes.SignAndVerifyModal, {
      screen: EModalSignAndVerifyRoutes.SignAndVerifyMessage,
      params: {
        networkId: network?.id,
        accountId: account?.id,
        walletId: wallet?.id,
        indexedAccountId: indexedAccount?.id,
        deriveInfoItems,
        deriveType,
        isOthersWallet,
      },
    });
    onClose();
  }, [
    navigation,
    onClose,
    account,
    deriveInfoItems,
    deriveType,
    indexedAccount,
    isOthersWallet,
    network,
    wallet,
  ]);

  return (
    <ActionList.Item
      trackID="wallet-action-sign-and-verify"
      icon="HighlightOutline"
      label={intl.formatMessage({
        id: ETranslations.message_signing_main_title,
      })}
      onClose={() => {}}
      onPress={handleSignAndVerify}
    />
  );
}

import { useIntl } from 'react-intl';

import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EAccountManagerStacksRoutes,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { WalletOptionItem } from './WalletOptionItem';

function BatchCreateAccountButtonView({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });

  return (
    <WalletOptionItem
      testID="account-batch-add-account"
      icon="Back10Outline"
      label={intl.formatMessage({ id: ETranslations.global_bulk_add_accounts })}
      onPress={() => {
        navigation.pushModal(EModalRoutes.AccountManagerStacks, {
          screen: EAccountManagerStacksRoutes.BatchCreateAccountForm,
          params: {
            walletId: wallet?.id || '',
            networkId: activeAccount?.network?.id,
          },
        });
      }}
    />
  );
}

export function BatchCreateAccountButton({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <BatchCreateAccountButtonView wallet={wallet} />
    </AccountSelectorProviderMirror>
  );
}

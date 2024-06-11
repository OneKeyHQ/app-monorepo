import { useIntl } from 'react-intl';

import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { WalletOptionItem } from '../../pages/AccountSelectorStack/WalletDetails/WalletOptions/WalletOptionItem';

export function HiddenWalletAddButton({ wallet }: { wallet?: IDBWallet }) {
  const intl = useIntl();
  const actions = useAccountSelectorActions();

  if (
    wallet &&
    accountUtils.isHwWallet({
      walletId: wallet.id,
    }) &&
    !accountUtils.isHwHiddenWallet({ wallet })
  ) {
    return (
      <WalletOptionItem
        icon="LockOutline"
        label={intl.formatMessage({
          id: ETranslations.global_add_hidden_wallet,
        })}
        onPress={async () => {
          await actions.current.createHWHiddenWallet({
            walletId: wallet?.id,
          });
        }}
      />
    );
  }

  return null;
}

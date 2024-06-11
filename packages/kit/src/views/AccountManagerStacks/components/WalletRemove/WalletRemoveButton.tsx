import { useIntl } from 'react-intl';

import { IconButton } from '@onekeyhq/components';
import { useAccountSelectorContextData } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { showWalletRemoveDialog } from './WalletRemoveDialog';

export function WalletRemoveButton({ wallet }: { wallet?: IDBWallet }) {
  const { config } = useAccountSelectorContextData();
  const intl = useIntl();

  function getTitleAndDescription() {
    if (wallet?.type === 'hw') {
      if (
        accountUtils.isHwHiddenWallet({
          wallet,
        })
      ) {
        return {
          title: intl.formatMessage({ id: ETranslations.remove_device }),
          description: intl.formatMessage({
            id: ETranslations.remove_hidden_wallet_desc,
          }),
        };
      }
      return {
        title: intl.formatMessage({ id: ETranslations.remove_device }),
        description: intl.formatMessage({
          id: ETranslations.remove_device_desc,
        }),
      };
    }

    return {
      title: intl.formatMessage({ id: ETranslations.remove_wallet }),
      description: intl.formatMessage({ id: ETranslations.remove_wallet_desc }),
    };
  }
  const { title, description } = getTitleAndDescription();

  return (
    <IconButton
      title={intl.formatMessage({ id: ETranslations.global_remove })}
      icon="DeleteOutline"
      variant="tertiary"
      onPress={() => {
        showWalletRemoveDialog({
          config,
          title,
          description,
          showCheckBox: wallet?.type !== 'hw',
          defaultChecked: false,
          wallet,
        });
      }}
    />
  );
}

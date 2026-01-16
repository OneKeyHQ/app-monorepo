import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import { useAddHiddenWallet } from '@onekeyhq/kit/src/views/AccountManagerStacks/pages/AccountSelectorStack/WalletDetails/hooks/useAddHiddenWallet';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function AddHiddenWalletButton({
  wallet,
  onClose,
}: {
  wallet: IDBWallet | undefined;
  onClose: () => void;
}) {
  const intl = useIntl();
  const { createHiddenWalletWithDialogConfirm, isLoading } =
    useAddHiddenWallet();

  return (
    <ActionList.Item
      icon="PlusSmallOutline"
      label={intl.formatMessage({ id: ETranslations.global_add_hidden_wallet })}
      isLoading={isLoading}
      onPress={async () => {
        try {
          onClose();
          await createHiddenWalletWithDialogConfirm({ wallet });
        } catch (error) {
          if (error instanceof Error && error.message !== 'User cancelled') {
            errorToastUtils.toastIfError(error);
          }
          throw error;
        }
      }}
      onClose={onClose}
    />
  );
}

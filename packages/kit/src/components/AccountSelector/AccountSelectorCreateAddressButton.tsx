import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button } from '@onekeyhq/components';
import type { IDBWalletId } from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { useAccountSelectorCreateAddress } from './hooks/useAccountSelectorCreateAddress';

export function AccountSelectorCreateAddressButton({
  num,
  children, // Button text
  selectAfterCreate,
  account,
  buttonRender,
}: {
  num: number;
  children?: React.ReactNode;
  selectAfterCreate?: boolean;
  account: {
    walletId: IDBWalletId | undefined;
    networkId: string | undefined;
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes;
  };
  buttonRender?: (props: IButtonProps) => React.ReactNode;
}) {
  const intl = useIntl();
  const { serviceAccount } = backgroundApiProxy;

  const { createAddress } = useAccountSelectorCreateAddress();
  const [isLoading, setIsLoading] = useState(false);
  // eslint-disable-next-line no-param-reassign
  buttonRender =
    buttonRender ||
    ((props) => (
      <Button size="small" borderWidth={0} variant="tertiary" {...props} />
    ));
  return buttonRender({
    loading: isLoading,
    onPress: async () => {
      setIsLoading(true);
      try {
        if (process.env.NODE_ENV !== 'production' && account?.walletId) {
          const wallet = await serviceAccount.getWallet({
            walletId: account?.walletId,
          });
          console.log({ wallet });
        }
        await createAddress({ num, selectAfterCreate, account });
      } finally {
        setIsLoading(false);
      }
    },
    children:
      children ||
      intl.formatMessage({ id: ETranslations.global_create_address }),
  });
}

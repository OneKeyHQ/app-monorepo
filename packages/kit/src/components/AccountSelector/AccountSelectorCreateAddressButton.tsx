import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIsFocused } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { Button } from '@onekeyhq/components';
import type { IDBWalletId } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { useAccountIsAutoCreatingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { useAccountSelectorCreateAddress } from './hooks/useAccountSelectorCreateAddress';

export function AccountSelectorCreateAddressButton({
  num,
  children, // Button text
  selectAfterCreate,
  autoCreateAddress,
  account,
  buttonRender,
}: {
  num: number;
  children?: React.ReactNode;
  selectAfterCreate?: boolean;
  autoCreateAddress?: boolean;
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
  const [accountIsAutoCreating, setAccountIsAutoCreating] =
    useAccountIsAutoCreatingAtom();
  const isFocused = useIsFocused();

  const networkId = account?.networkId;
  const deriveType = account?.deriveType;
  const walletId = account?.walletId;
  const indexedAccountId = account?.indexedAccountId;

  const accountRef = useRef(account);
  accountRef.current = account;

  const { createAddress } = useAccountSelectorCreateAddress();
  const [isLoadingState, setIsLoading] = useState(false);

  const isLoading = useMemo(
    () =>
      isLoadingState ||
      (accountIsAutoCreating &&
        accountIsAutoCreating.walletId === walletId &&
        accountIsAutoCreating.indexedAccountId === indexedAccountId &&
        accountIsAutoCreating.networkId === networkId &&
        accountIsAutoCreating.deriveType === deriveType),
    [
      accountIsAutoCreating,
      deriveType,
      indexedAccountId,
      isLoadingState,
      networkId,
      walletId,
    ],
  );

  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  // eslint-disable-next-line no-param-reassign
  buttonRender =
    buttonRender ||
    ((props) => (
      <Button size="small" borderWidth={0} variant="tertiary" {...props} />
    ));

  const doCreate = useCallback(async () => {
    if (isLoadingRef.current) {
      return;
    }
    isLoadingRef.current = true;
    setIsLoading(true);
    setAccountIsAutoCreating(accountRef.current);
    try {
      if (process.env.NODE_ENV !== 'production' && account?.walletId) {
        const wallet = await serviceAccount.getWallet({
          walletId: account?.walletId,
        });
        console.log({ wallet });
      }
      await createAddress({ num, selectAfterCreate, account });
      await timerUtils.wait(300);
    } finally {
      setIsLoading(false);
      setAccountIsAutoCreating(undefined);
    }
  }, [
    account,
    createAddress,
    num,
    selectAfterCreate,
    serviceAccount,
    setAccountIsAutoCreating,
  ]);

  useEffect(() => {
    void (async () => {
      if (
        isFocused &&
        walletId &&
        networkId &&
        deriveType &&
        autoCreateAddress
      ) {
        const canAutoCreate =
          await backgroundApiProxy.serviceAccount.canAutoCreateAddressInSilentMode(
            {
              walletId,
              networkId,
              deriveType,
            },
          );
        if (canAutoCreate) {
          try {
            await doCreate();
          } catch (error) {
            errorUtils.autoPrintErrorIgnore(error); // mute auto print log error
            errorUtils.toastIfErrorDisable(error); // mute auto toast when auto create
            throw error;
          } finally {
            //
          }
        }
      }
    })();
  }, [isFocused, autoCreateAddress, deriveType, doCreate, networkId, walletId]);

  return buttonRender({
    loading: isLoading,
    onPress: doCreate,
    children:
      children ||
      intl.formatMessage({ id: ETranslations.global_create_address }),
  });
}

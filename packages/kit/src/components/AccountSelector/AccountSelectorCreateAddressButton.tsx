import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { IButtonProps } from '@onekeyhq/components';
import { Button } from '@onekeyhq/components';
import { useRouteIsFocused as useIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import type {
  IDBAccount,
  IDBWalletId,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  useAccountIsAutoCreatingAtom,
  useAccountManualCreatingAtom,
  useIndexedAccountAddressCreationStateAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '../../hooks/useAllNetwork';

import { useAccountSelectorCreateAddress } from './hooks/useAccountSelectorCreateAddress';

export function AccountSelectorCreateAddressButton({
  num,
  children, // Button text
  selectAfterCreate,
  autoCreateAddress,
  account,
  buttonRender,
  onCreateDone,
  onPressLog,
  createAllDeriveTypes,
  createAllEnabledNetworks,
}: {
  num: number;
  children?: React.ReactNode;
  selectAfterCreate?: boolean;
  autoCreateAddress?: boolean;
  account: {
    walletId: IDBWalletId | undefined;
    networkId: string | undefined;
    indexedAccountId: string | undefined;
    deriveType: IAccountDeriveTypes | undefined;
  };
  buttonRender?: (props: IButtonProps) => React.ReactNode;
  onCreateDone?: (
    params:
      | {
          walletId: string | undefined;
          indexedAccountId: string | undefined;
          accounts: IDBAccount[];
        }
      | undefined,
  ) => void;
  onPressLog?: () => void;
  createAllDeriveTypes?: boolean;
  createAllEnabledNetworks?: boolean;
}) {
  const intl = useIntl();
  const { serviceAccount } = backgroundApiProxy;
  const [accountIsAutoCreating, setAccountIsAutoCreating] =
    useAccountIsAutoCreatingAtom();
  const [indexedAccountAddressCreationState] =
    useIndexedAccountAddressCreationStateAtom();
  const isFocused = useIsFocused();

  const networkId = account?.networkId;
  const deriveType = account?.deriveType;
  const walletId = account?.walletId;
  const indexedAccountId = account?.indexedAccountId;

  const accountRef = useRef(account);
  accountRef.current = account;

  const { createAddress } = useAccountSelectorCreateAddress();
  const { enabledNetworksWithoutAccount } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId: walletId ?? '',
      networkId,
      indexedAccountId,
      filterNetworksWithoutAccount: true,
    });
  const manualCreatingKey = useMemo(
    () =>
      networkId && walletId && (deriveType || indexedAccountId)
        ? [networkId, deriveType, walletId, indexedAccountId].join('-')
        : Math.random().toString(),
    [deriveType, indexedAccountId, networkId, walletId],
  );

  const [accountManualCreatingAtom, setAccountManualCreatingAtom] =
    useAccountManualCreatingAtom();

  const [addressCreationState] = useIndexedAccountAddressCreationStateAtom();

  const isLoading = useMemo(
    () =>
      (accountManualCreatingAtom.isLoading &&
        accountManualCreatingAtom.key === manualCreatingKey) ||
      (addressCreationState &&
        addressCreationState?.indexedAccountId === indexedAccountId &&
        addressCreationState?.walletId === walletId) ||
      (accountIsAutoCreating &&
        accountIsAutoCreating.walletId === walletId &&
        accountIsAutoCreating.indexedAccountId === indexedAccountId &&
        accountIsAutoCreating.networkId === networkId &&
        accountIsAutoCreating.deriveType === deriveType) ||
      (indexedAccountAddressCreationState?.indexedAccountId ===
        indexedAccountId &&
        indexedAccountAddressCreationState?.walletId === walletId),
    [
      accountManualCreatingAtom.isLoading,
      accountManualCreatingAtom.key,
      manualCreatingKey,
      addressCreationState,
      indexedAccountId,
      walletId,
      accountIsAutoCreating,
      networkId,
      deriveType,
      indexedAccountAddressCreationState?.indexedAccountId,
      indexedAccountAddressCreationState?.walletId,
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
    defaultLogger.account.accountCreatePerf.createAddressRunStart();
    if (isLoadingRef.current) {
      return;
    }
    if (!accountRef.current?.deriveType) {
      return;
    }
    const deriveType0 = accountRef.current.deriveType;
    isLoadingRef.current = true;
    setAccountManualCreatingAtom((prev) => ({
      ...prev,
      key: manualCreatingKey,
      isLoading: true,
    }));
    const accountToCreate = {
      ...accountRef.current,
      deriveType: deriveType0,
    };
    setAccountIsAutoCreating(accountToCreate);
    let resp:
      | {
          walletId: string | undefined;
          indexedAccountId: string | undefined;
          accounts: IDBAccount[];
        }
      | undefined;
    try {
      if (process.env.NODE_ENV !== 'production' && accountToCreate.walletId) {
        const wallet = await serviceAccount.getWallet({
          walletId: accountToCreate.walletId,
        });
        console.log({ wallet });
      }

      const customNetworks: {
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }[] = [];

      if (
        createAllEnabledNetworks &&
        networkUtils.isAllNetwork({ networkId })
      ) {
        for (const network of enabledNetworksWithoutAccount) {
          customNetworks.push({
            networkId: network.id,
            deriveType:
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                {
                  networkId: network.id,
                },
              ),
          });
        }
      }

      resp = await createAddress({
        num,
        selectAfterCreate,
        account: accountToCreate,
        createAllDeriveTypes,
        customNetworks,
      });
      defaultLogger.account.accountCreatePerf.createAddressRunFinished();
      await timerUtils.wait(300);
    } finally {
      setAccountManualCreatingAtom((prev) => ({
        ...prev,
        key: undefined,
        isLoading: false,
      }));
      setAccountIsAutoCreating(undefined);
      onCreateDone?.(resp);
    }
  }, [
    setAccountManualCreatingAtom,
    setAccountIsAutoCreating,
    manualCreatingKey,
    createAllEnabledNetworks,
    networkId,
    createAddress,
    num,
    selectAfterCreate,
    createAllDeriveTypes,
    serviceAccount,
    enabledNetworksWithoutAccount,
    onCreateDone,
  ]);

  const doAutoCreate = useDebouncedCallback(
    async (params: {
      isFocused: boolean;
      walletId: string | undefined;
      networkId: string | undefined;
      deriveType: IAccountDeriveTypes | undefined;
      autoCreateAddress: boolean | undefined;
    }) => {
      if (
        params.isFocused &&
        params.walletId &&
        params.networkId &&
        params.deriveType &&
        params.autoCreateAddress
      ) {
        const canAutoCreate =
          await backgroundApiProxy.serviceAccount.canAutoCreateAddressInSilentMode(
            {
              walletId: params.walletId,
              networkId: params.networkId,
              deriveType: params.deriveType,
            },
          );
        if (canAutoCreate) {
          try {
            await doCreate();
          } catch (error) {
            errorUtils.autoPrintErrorIgnore(error); // mute auto print log error
            errorToastUtils.toastIfErrorDisable(error); // mute auto toast when auto create
            throw error;
          } finally {
            //
          }
        }
      }
    },
    300,
  );

  useEffect(() => {
    void doAutoCreate({
      isFocused,
      walletId,
      networkId,
      deriveType,
      autoCreateAddress,
    });
  }, [
    isFocused,
    walletId,
    networkId,
    deriveType,
    autoCreateAddress,
    doAutoCreate,
  ]);

  const onPress = useCallback(async () => {
    onPressLog?.();
    await doCreate();
  }, [doCreate, onPressLog]);

  return buttonRender({
    loading: isLoading,
    onPress,
    children:
      children ??
      intl.formatMessage({ id: ETranslations.global_create_address }),
  });
}

import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, Toast } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import type { IDBAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorCreateAddressButton } from '../../../components/AccountSelector/AccountSelectorCreateAddressButton';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector/AccountSelectorProvider';
import { useAccountSelectorTrigger } from '../../../components/AccountSelector/hooks/useAccountSelectorTrigger';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function CreateAddressButton(props: IButtonProps) {
  const intl = useIntl();
  return (
    <Button
      $md={
        {
          flexGrow: 1,
          flexBasis: 0,
          size: 'large',
        } as any
      }
      variant="primary"
      {...props}
    >
      {intl.formatMessage({ id: ETranslations.global_create_address })}
    </Button>
  );
}

function BasicCreateAddressDialogContent({
  onCreate,
  networkId,
  indexedAccountId,
  autoCreateAddress,
}: {
  onCreate: (
    params:
      | {
          walletId: string | undefined;
          indexedAccountId: string | undefined;
          accounts: IDBAccount[];
        }
      | undefined,
  ) => void;
  networkId: string;
  indexedAccountId?: string;
  autoCreateAddress: boolean;
}) {
  const {
    activeAccount: { wallet, deriveType },
  } = useActiveAccount({ num: 0 });

  return (
    <AccountSelectorCreateAddressButton
      num={0}
      selectAfterCreate
      autoCreateAddress={autoCreateAddress}
      onCreateDone={onCreate}
      account={{
        walletId: wallet?.id,
        networkId,
        indexedAccountId,
        deriveType,
      }}
      buttonRender={CreateAddressButton}
    />
  );
}

function CreateAddressDialogContent({
  onCreate,
  networkId,
  indexedAccountId,
  autoCreateAddress,
}: {
  onCreate: (
    params:
      | {
          walletId: string | undefined;
          indexedAccountId: string | undefined;
          accounts: IDBAccount[];
        }
      | undefined,
  ) => void;
  networkId: string;
  indexedAccountId?: string;
  autoCreateAddress: boolean;
}) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BasicCreateAddressDialogContent
        onCreate={onCreate}
        networkId={networkId}
        indexedAccountId={indexedAccountId}
        autoCreateAddress={autoCreateAddress}
      />
    </AccountSelectorProviderMirror>
  );
}

function BasicCreateAddressContainer() {
  const intl = useIntl();
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    linkNetwork: false,
  });
  const showSwitchAccountSelector = useCallback(
    ({ networkId }: { networkId: string }) => {
      Dialog.confirm({
        icon: 'ErrorOutline',
        tone: 'warning',
        title: intl.formatMessage(
          {
            id: ETranslations.wallet_unsupported_network_title,
          },
          {
            network: networkId.split('--')[0].toUpperCase() || '',
          },
        ),
        description: intl.formatMessage({
          id: ETranslations.global_switch_supported_accounts_wallets,
        }),
        onConfirm: showAccountSelector,
        onConfirmText: intl.formatMessage({
          id: ETranslations.global_switch,
        }),
      });
    },
    [intl, showAccountSelector],
  );

  const handleCreateAddress = useCallback(
    ({
      networkId,
      indexedAccountId,
      promiseId,
      autoCreateAddress,
    }: {
      networkId: string;
      indexedAccountId: string;
      promiseId: number;
      autoCreateAddress: boolean;
    }) => {
      const dialog = Dialog.show({
        title: intl.formatMessage({
          id: ETranslations.wallet_no_address,
        }),
        icon: 'WalletCryptoOutline',
        description: intl.formatMessage(
          {
            id: ETranslations.global_private_key_error,
          },
          {
            network: networkId.split('--')[0].toUpperCase(),
            path: '',
          },
        ),
        showFooter: false,
        onClose: (extra) => {
          if (extra?.flag !== 'created') {
            void backgroundApiProxy.servicePromise.resolveCallback({
              id: promiseId,
              data: false,
            });
          }
        },
        renderContent: (
          <CreateAddressDialogContent
            onCreate={async (params) => {
              const isCreated = !!params;
              await backgroundApiProxy.servicePromise.resolveCallback({
                id: promiseId,
                data: isCreated,
              });
              if (isCreated) {
                await dialog.close({ flag: 'created' });
                Toast.success({
                  title: intl.formatMessage({
                    id: ETranslations.swap_page_toast_address_generated,
                  }),
                });
              } else {
                await dialog.close();
              }
            }}
            networkId={networkId}
            indexedAccountId={indexedAccountId}
            autoCreateAddress={autoCreateAddress}
          />
        ),
      });
    },
    [intl],
  );

  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.ShowSwitchAccountSelector,
      showSwitchAccountSelector,
    );
    appEventBus.on(
      EAppEventBusNames.CreateAddressByDialog,
      handleCreateAddress,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowSwitchAccountSelector,
        showSwitchAccountSelector,
      );
      appEventBus.off(
        EAppEventBusNames.CreateAddressByDialog,
        handleCreateAddress,
      );
    };
  }, [handleCreateAddress, showSwitchAccountSelector]);
  return null;
}

export function CreateAddressContainer() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <BasicCreateAddressContainer />
    </AccountSelectorProviderMirror>
  );
}

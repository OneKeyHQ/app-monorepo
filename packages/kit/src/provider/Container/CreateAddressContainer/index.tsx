import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, SizableText, Toast } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
}: {
  onCreate: () => void;
  networkId: string;
  indexedAccountId?: string;
}) {
  const intl = useIntl();
  const {
    activeAccount: { wallet, deriveType, indexedAccount },
  } = useActiveAccount({ num: 0 });

  return (
    <AccountSelectorCreateAddressButton
      num={0}
      selectAfterCreate
      onCreateDone={onCreate}
      account={{
        walletId: wallet?.id,
        networkId,
        indexedAccountId: indexedAccount?.id,
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
}: {
  onCreate: () => void;
  networkId: string;
  indexedAccountId?: string;
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
      />
    </AccountSelectorProviderMirror>
  );
}

function BasicCreateAddressContainer() {
  //   const isCreated = await new Promise<boolean>((resolve) => {
  //     const dialog = Dialog.show({
  //       title: intl.formatMessage({
  //         id: ETranslations.wallet_no_address,
  //       }),
  //       icon: 'WalletCryptoOutline',
  //       description: intl.formatMessage(
  //         {
  //           id: ETranslations.global_private_key_error,
  //         },
  //         {
  //           network: networkId.split('--')[0].toUpperCase(),
  //           path: networkUtils.isBTCNetwork(networkId) ? '(Taproot)' : '',
  //         },
  //       ),
  //       showFooter: false,
  //       onClose: (extra) => {
  //         if (extra?.flag !== 'created') {
  //           resolve(false);
  //         }
  //       },
  //       renderContent: (
  //         <CreateAddressDialogContent
  //           onCreate={async () => {
  //             resolve(true);
  //             await dialog.close({ flag: 'created' });
  //             Toast.success({
  //               title: intl.formatMessage({
  //                 id: ETranslations.swap_page_toast_address_generated,
  //               }),
  //             });
  //           }}
  //           networkId={networkId}
  //           indexedAccountId={activeAccount.account?.indexedAccountId}
  //         />
  //       ),
  //     });
  //   });
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

  useEffect(() => {
    appEventBus.on(
      EAppEventBusNames.ShowSwitchAccountSelector,
      showSwitchAccountSelector,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.ShowSwitchAccountSelector,
        showSwitchAccountSelector,
      );
    };
  }, [showSwitchAccountSelector]);
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

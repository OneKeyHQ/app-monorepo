import { useIntl } from 'react-intl';

import { Badge, Dialog, Stack, XStack } from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector';
import { AccountSelectorProviderMirror } from '../AccountSelector';

type IProps = {
  accountId?: string;
  networkId: string;
  address: string;
  allowClickAccountNameSwitch?: boolean;
};

type ISwitchHomeAccountButtonProps = {
  accountId: string | undefined;
  children: React.ReactNode;
  walletAccountName: string;
};
function SwitchHomeAccountButton({
  accountId,
  walletAccountName,
  children,
}: ISwitchHomeAccountButtonProps) {
  const actions = useAccountSelectorActions();
  const navigation = useAppNavigation();
  const intl = useIntl();
  return (
    <Stack
      onPress={async () => {
        Dialog.show({
          icon: 'SwitchHorOutline',
          title: intl.formatMessage(
            {
              id: ETranslations.history_switch_account_dialog_title,
            },
            {
              account: walletAccountName,
            },
          ), // `Switch primary account to ${walletAccountName}`,
          onConfirm: async () => {
            let account: IDBAccount | undefined;
            let indexedAccount: IDBIndexedAccount | undefined;

            // eslint-disable-next-line prefer-const
            account = await backgroundApiProxy.serviceAccount.getDBAccountSafe({
              accountId: accountId || '',
            });

            if (account) {
              indexedAccount =
                await backgroundApiProxy.serviceAccount.getIndexedAccountByAccount(
                  {
                    account,
                  },
                );
            } else {
              // may be indexedAccountId
              indexedAccount =
                await backgroundApiProxy.serviceAccount.getIndexedAccountSafe({
                  id: accountId || '',
                });
            }

            if (!indexedAccount && !account) {
              return;
            }

            // TODO pop to top
            navigation.popStack();
            navigation.popStack();
            navigation.popStack();
            navigation.navigate(ERootRoutes.Main, {
              screen: ETabRoutes.Home,
              params: {},
            });

            setTimeout(async () => {
              await actions.current.confirmAccountSelect({
                num: 0,
                othersWalletAccount: indexedAccount ? undefined : account,
                indexedAccount,
              });
            }, 300);
          },
        });
      }}
    >
      {children}
    </Stack>
  );
}

function SwitchHomeAccountContainer(props: ISwitchHomeAccountButtonProps) {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <SwitchHomeAccountButton {...props} />
    </AccountSelectorProviderMirror>
  );
}

function AddressInfo(props: IProps) {
  const { accountId, networkId, address, allowClickAccountNameSwitch } = props;
  const addressQueryResult = usePromiseResult(
    () =>
      backgroundApiProxy.serviceAccountProfile.queryAddress({
        accountId,
        networkId,
        address,
        enableAddressBook: true,
        enableWalletName: true,
        skipValidateAddress: true,
      }),
    [accountId, address, networkId],
  ).result;

  if (!addressQueryResult) {
    return null;
  }

  if (
    !addressQueryResult.walletAccountName &&
    !addressQueryResult.addressBookName
  ) {
    return null;
  }

  const AccountNameContainer = allowClickAccountNameSwitch
    ? SwitchHomeAccountContainer
    : Stack;

  return (
    <XStack gap="$2" flex={1} flexWrap="wrap">
      {addressQueryResult.walletAccountName ? (
        <AccountNameContainer
          walletAccountName={addressQueryResult.walletAccountName}
          accountId={addressQueryResult.walletAccountId}
        >
          <Badge badgeType="success" badgeSize="sm">
            {addressQueryResult.walletAccountName}
          </Badge>
        </AccountNameContainer>
      ) : null}
      {addressQueryResult.addressBookName ? (
        <Badge badgeType="success" badgeSize="sm">
          {addressQueryResult.addressBookName}
        </Badge>
      ) : null}
    </XStack>
  );
}

export { AddressInfo };

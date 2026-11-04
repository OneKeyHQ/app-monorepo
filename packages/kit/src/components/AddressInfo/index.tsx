import { useIntl } from 'react-intl';

import { Badge, Dialog, Stack, Toast, XStack } from '@onekeyhq/components';
import type { IDBIndexedAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { ERootRoutes, ETabRoutes } from '@onekeyhq/shared/src/routes';
import { buildAddressMapInfoKey } from '@onekeyhq/shared/src/utils/historyUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useAccountSelectorActions } from '../../states/jotai/contexts/accountSelector/actions';
import { AccountSelectorProviderMirror } from '../AccountSelector';
import { AddressBadge } from '../AddressBadge';

type IProps = {
  accountId?: string;
  networkId: string;
  address: string;
  allowClickAccountNameSwitch?: boolean;
  withWrapper?: boolean;
  addressMap?: Record<string, IAddressInfo>;
};

type ISwitchHomeAccountButtonProps = {
  accountId?: string;
  children: React.ReactNode;
  walletAccountName: string;
};
export function SwitchHomeAccountButton({
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
            let indexedAccount: IDBIndexedAccount | undefined;

            const account =
              await backgroundApiProxy.serviceAccount.getDBAccountSafe({
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
            navigation.navigate(
              ERootRoutes.Main,
              {
                screen: ETabRoutes.Home,
                params: {},
              },
              {
                pop: true,
              },
            );

            setTimeout(async () => {
              try {
                const confirmed = await actions.current.confirmAccountSelect({
                  num: 0,
                  othersWalletAccount: indexedAccount ? undefined : account,
                  entry: 'addressInfo',
                  indexedAccount,
                  throwOnError: true,
                });
                // `false` includes a stale request superseded by a newer
                // selection, so only thrown execution failures show a toast.
                if (!confirmed) {
                  // No follow-up work depends on the rejected selection.
                }
              } catch {
                // An uncaught rejection inside setTimeout has no caller left
                // to surface it, so tell the user the switch did not happen.
                Toast.error({
                  title: intl.formatMessage({
                    id: ETranslations.global_an_error_occurred,
                  }),
                  message: intl.formatMessage({
                    id: ETranslations.global_an_error_occurred_desc,
                  }),
                });
              }
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
  const {
    accountId,
    networkId,
    address,
    allowClickAccountNameSwitch,
    withWrapper = true,
    addressMap,
  } = props;
  const addressQueryResult = usePromiseResult(async () => {
    const result = await backgroundApiProxy.serviceAccountProfile.queryAddress({
      accountId,
      networkId,
      address,
      enableAddressBook: true,
      enableWalletName: true,
      skipValidateAddress: true,
    });
    return result;
  }, [accountId, address, networkId]).result;

  const addressInfoKey = buildAddressMapInfoKey({
    address,
    networkId,
  });

  const addressInfo = addressMap?.[addressInfoKey];

  if (
    !addressQueryResult?.walletAccountName &&
    !addressQueryResult?.addressBookName &&
    !addressInfo
  ) {
    return null;
  }

  const renderWalletAccountName = () => {
    if (!addressQueryResult?.walletAccountName) return null;

    const badge = (
      <Badge badgeType="success" badgeSize="sm">
        {addressQueryResult.walletAccountName}
      </Badge>
    );

    if (allowClickAccountNameSwitch) {
      return (
        <SwitchHomeAccountContainer
          walletAccountName={addressQueryResult.walletAccountName}
          accountId={addressQueryResult?.walletAccountId}
        >
          {badge}
        </SwitchHomeAccountContainer>
      );
    }

    return <Stack maxWidth="100%">{badge}</Stack>;
  };

  const renderAddressBookName = () => {
    if (!addressQueryResult?.addressBookName) return null;
    return (
      <Badge badgeType="success" badgeSize="sm">
        {addressQueryResult.addressBookName}
      </Badge>
    );
  };

  const renderAddressInfo = () => {
    if (!addressInfo) return null;
    return (
      <AddressBadge
        title={addressInfo.label}
        badgeType={addressInfo.type}
        icon={addressInfo.icon}
      />
    );
  };

  const content = (
    <>
      {renderWalletAccountName()}
      {renderAddressBookName()}
      {renderAddressInfo()}
    </>
  );

  return withWrapper ? (
    <XStack gap="$2" flex={1} flexWrap="wrap">
      {content}
    </XStack>
  ) : (
    content
  );
}

export { AddressInfo };

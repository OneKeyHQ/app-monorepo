import React, { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  DialogManager,
  IconButton,
  Select,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { SelectItem } from '@onekeyhq/components/src/Select';
import { IAccount, INetwork, IWallet } from '@onekeyhq/engine/src/types';
import { WALLET_TYPE_HW } from '@onekeyhq/engine/src/types/wallet';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useCopyAddress } from '../../../hooks/useCopyAddress';
import useLocalAuthenticationModal from '../../../hooks/useLocalAuthenticationModal';
import { ManagerAccountModalRoutes } from '../../../routes/Modal/ManagerAccount';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { refreshAccountSelector } from '../../../store/reducers/refresher';
import AccountModifyNameDialog from '../../../views/ManagerAccount/ModifyAccount';
import useRemoveAccountDialog from '../../../views/ManagerAccount/RemoveAccount';
import { ValidationFields } from '../../Protected';

enum EAccountSelectorItemSelectOptions {
  rename = 'rename',
  copy = 'copy',
  detail = 'detail',
  remove = 'remove',
}

function AccountItemSelectDropdown({
  account,
  wallet,
  network,
}: {
  account: IAccount;
  wallet: IWallet;
  network: INetwork | null | undefined;
}) {
  const { type } = wallet;
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useAppNavigation();
  const isHardwareWallet = type === WALLET_TYPE_HW;
  const { dispatch } = backgroundApiProxy;
  const { showVerify } = useLocalAuthenticationModal();
  const { show: showRemoveAccountDialog, RemoveAccountDialog } =
    useRemoveAccountDialog();
  const { copyAddress } = useCopyAddress({
    wallet,
    account,
    network,
  });

  // TODO refreshAccounts
  const refreshAccounts = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (...args: any[]) => {
      dispatch(refreshAccountSelector());
    },
    [dispatch],
  );

  const selectOptions = useMemo(() => {
    const allOptions: Record<
      EAccountSelectorItemSelectOptions,
      SelectItem<EAccountSelectorItemSelectOptions>
    > = {
      [EAccountSelectorItemSelectOptions.rename]: {
        label: intl.formatMessage({ id: 'action__rename' }),
        value: EAccountSelectorItemSelectOptions.rename,
        iconProps: {
          name: isVerticalLayout ? 'TagOutline' : 'TagSolid',
        },
      },
      [EAccountSelectorItemSelectOptions.copy]: {
        label: intl.formatMessage({ id: 'action__copy_address' }),
        value: EAccountSelectorItemSelectOptions.copy,
        iconProps: {
          name: isVerticalLayout ? 'DuplicateOutline' : 'DuplicateSolid',
        },
      },
      [EAccountSelectorItemSelectOptions.detail]: {
        label: intl.formatMessage({ id: 'action__view_details' }),
        value: EAccountSelectorItemSelectOptions.detail,
        iconProps: {
          name: isVerticalLayout ? 'DocumentTextOutline' : 'DocumentTextSolid',
        },
      },
      [EAccountSelectorItemSelectOptions.remove]: {
        label: intl.formatMessage({ id: 'action__remove_account' }),
        value: EAccountSelectorItemSelectOptions.remove,
        iconProps: {
          name: isVerticalLayout ? 'TrashOutline' : 'TrashSolid',
        },
        destructive: true,
      },
    };

    if (isHardwareWallet) {
      // return [allOptions.rename, allOptions.copy];
    }
    return [
      allOptions.rename,
      allOptions.copy,
      allOptions.detail,
      allOptions.remove,
    ];
  }, [intl, isHardwareWallet, isVerticalLayout]);

  const handleChange = useCallback(
    (value: string) => {
      switch (value) {
        case 'copy':
          // TODO uppercase address copy
          copyAddress(account.displayAddress ?? account.address);
          break;
        case 'rename':
          DialogManager.show({
            render: (
              <AccountModifyNameDialog
                visible
                account={account}
                onDone={() => {
                  // TODO refreshAccounts
                  refreshAccounts(wallet?.id ?? '', network?.id ?? '');
                }}
              />
            ),
          });
          break;
        case 'detail':
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManagerAccount,
            params: {
              screen: ManagerAccountModalRoutes.ManagerAccountModal,
              params: {
                walletId: wallet?.id ?? '',
                accountId: account.id,
                networkId: network?.id ?? '',
                refreshAccounts: () =>
                  refreshAccounts(wallet?.id ?? '', network?.id ?? ''),
              },
            },
          });
          break;
        case 'remove':
          // bypass password verify
          if (wallet?.type === 'watching' || wallet?.type === 'external') {
            showRemoveAccountDialog(
              wallet?.id ?? '',
              account.id,
              undefined,
              () => refreshAccounts(wallet?.id ?? '', network?.id ?? ''),
            );
          } else {
            showVerify(
              (pwd) => {
                showRemoveAccountDialog(wallet?.id ?? '', account.id, pwd, () =>
                  refreshAccounts(wallet?.id ?? '', network?.id ?? ''),
                );
              },
              () => {},
              null,
              ValidationFields.Account,
            );
          }
          break;

        default:
          break;
      }
    },
    [
      account,
      copyAddress,
      navigation,
      network?.id,
      refreshAccounts,
      showRemoveAccountDialog,
      showVerify,
      wallet?.id,
      wallet?.type,
    ],
  );

  return (
    <>
      {/* TODO move to parent */}
      {RemoveAccountDialog}
      <Select
        dropdownPosition="right"
        onChange={handleChange}
        activatable={false}
        options={selectOptions}
        headerShown={false}
        footer={null}
        containerProps={{ width: 'auto' }}
        dropdownProps={{
          width: 248,
        }}
        renderTrigger={({ onPress }) => (
          <IconButton
            name="DotsVerticalSolid"
            type="plain"
            circle
            onPress={onPress}
            hitSlop={8}
            // TODO custom props
            // isTriggerHovered={isHovered}
            // isSelectVisible={visible}
            // isTriggerPressed={isPressed}
            // TODO hardware only
            // isNotification={hasAvailableUpdate}
            // notificationColor="icon-warning"
          />
        )}
      />
    </>
  );
}

export { AccountItemSelectDropdown };

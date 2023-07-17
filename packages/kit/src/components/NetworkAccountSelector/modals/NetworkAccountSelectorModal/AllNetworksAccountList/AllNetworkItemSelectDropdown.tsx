import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, IconButton } from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

import backgroundApiProxy from '../../../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../../../hooks';
import {
  ManageNetworkModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../../../routes/routesEnum';

const AccountItemMenu: FC<
  IMenu & {
    onChange: (value: string) => void;
  }
> = ({ onChange, ...props }) => {
  const onPress = useCallback(
    (value: string) => {
      onChange?.(value);
    },
    [onChange],
  );

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: 'action__copy_address',
        onPress: () => onPress('copy'),
        icon: 'Square2StackOutline',
      },
      {
        id: 'action__remove_account',
        onPress: () => onPress('remove'),
        icon: 'TrashOutline',
        variant: 'desctructive',
      },
    ],
    [onPress],
  );

  return <BaseMenu options={options} {...props} />;
};

function AllNetworksAccountItemSelectDropdown({
  accountId,
  walletId,
}: {
  accountId: string;
  walletId: string;
}) {
  const intl = useIntl();
  const [visible, setVisible] = useState(false);
  const navigation = useNavigation();

  const RemoveAccountDialog = useMemo(
    () =>
      visible && (
        <Dialog
          visible={visible}
          contentProps={{
            iconType: 'danger',
            title: intl.formatMessage({ id: 'action__remove_account' }),
            content: intl.formatMessage({
              id: 'modal__delete_account_desc',
            }),
          }}
          footerButtonProps={{
            primaryActionProps: {
              type: 'destructive',
              onPromise: () =>
                backgroundApiProxy.serviceAllNetwork.deleteAllNetworksFakeAccount(
                  {
                    accountId,
                  },
                ),
            },
            primaryActionTranslationId: 'action__remove',
            onSecondaryActionPress: () => setVisible(false),
          }}
        />
      ),

    [intl, visible, accountId],
  );

  const handleChange = useCallback(
    (value: string) => {
      switch (value) {
        case 'copy':
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManageNetwork,
            params: {
              screen: ManageNetworkModalRoutes.AllNetworksAccountsDetail,
              params: {
                walletId,
                accountId,
              },
            },
          });
          break;
        case 'remove':
          setVisible(true);
          break;
        default:
          break;
      }
    },
    [accountId, walletId, navigation],
  );

  return (
    <>
      {RemoveAccountDialog}
      <AccountItemMenu onChange={handleChange}>
        <IconButton
          name="EllipsisVerticalMini"
          type="plain"
          circle
          hitSlop={8}
        />
      </AccountItemMenu>
    </>
  );
}

export { AllNetworksAccountItemSelectDropdown };

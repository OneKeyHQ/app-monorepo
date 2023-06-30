import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { Divider, IconButton } from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

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
        id: 'action__view_details',
        onPress: () => onPress('detail'),
        icon: 'DocumentOutline',
      },
      () => <Divider my={1} />,
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
  const navigation = useNavigation();
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
        case 'detail':
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.ManageNetwork,
            params: {
              screen: ManageNetworkModalRoutes.AllNetworksNetworkSelector,
              params: {
                walletId,
                accountId,
              },
            },
          });
          break;
        default:
          break;
      }
    },
    [accountId, walletId, navigation],
  );

  return (
    <AccountItemMenu onChange={handleChange}>
      <IconButton name="EllipsisVerticalMini" type="plain" circle hitSlop={8} />
    </AccountItemMenu>
  );
}

export { AllNetworksAccountItemSelectDropdown };

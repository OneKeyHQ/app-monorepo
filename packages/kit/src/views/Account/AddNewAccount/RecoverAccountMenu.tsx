import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { CheckBox, Divider } from '@onekeyhq/components';
import type { CreateAccountRoutesParams } from '@onekeyhq/kit/src/routes';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

import { useNavigation } from '../../../hooks';
import {
  ModalRoutes,
  RecoverAccountModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

const RecoverAccountMenu: FC<
  IMenu & {
    showPath: boolean;
    onChange: (isChecked: boolean) => void;
    password: string;
    walletId: string;
    networkId: string;
    template: string;
  }
> = (props) => {
  const { showPath, onChange, password, walletId, networkId, template } = props;
  const navigation = useNavigation<NavigationProps['navigation']>();

  const onPressShowPath = useCallback(() => {
    onChange?.(!showPath);
  }, [onChange, showPath]);

  const showPathCheckBox = useMemo(
    () => (
      <CheckBox
        w="20px"
        isChecked={showPath}
        isDisabled={false}
        onChange={onPressShowPath}
        pointerEvents="box-only"
      />
    ),
    [showPath, onPressShowPath],
  );

  const onPressBulkCopyAddresses = useCallback(() => {
    setTimeout(() => {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.RecoverAccount,
        params: {
          screen: RecoverAccountModalRoutes.BulkCopyAddresses,
          params: {
            walletId,
            networkId,
            password,
            entry: 'manageAccount',
            template,
          },
        },
      });
    });
  }, [navigation, walletId, networkId, password, template]);

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: 'title__bulk_copy_addresses',
        onPress: onPressBulkCopyAddresses,
        icon: 'Square2StackOutline',
      },
      () => <Divider my={1} />,
      {
        id: 'action__show_path',
        onPress: onPressShowPath,
        extraChildren: showPathCheckBox,
      },
    ],
    [onPressShowPath, showPathCheckBox, onPressBulkCopyAddresses],
  );

  return <BaseMenu options={options} {...props} menuWidth={220} />;
};

export default RecoverAccountMenu;

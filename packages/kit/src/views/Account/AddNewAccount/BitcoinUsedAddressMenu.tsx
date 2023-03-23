import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { CheckBox, Divider } from '@onekeyhq/components';
import type { Account } from '@onekeyhq/engine/src/types/account';
import type { CreateAccountRoutesParams } from '@onekeyhq/kit/src/routes';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import {
  CreateAccountModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { deviceUtils } from '../../../utils/hardware';

import showFindAddressByPathBottomSheetModal from './FindAddressByPathBottomSheetModal';

import type { IDerivationOption } from '../../../components/NetworkAccountSelector/hooks/useDerivationPath';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;

const BitcoinUsedAddressMenu: FC<
  IMenu & {
    showPath: boolean;
    onChange: (isChecked: boolean) => void;
    walletId: string;
    networkId: string;
    accountId: string;
    onAddedCustomAddressCallback: () => void;
  }
> = (props) => {
  const {
    showPath,
    onChange,
    walletId,
    networkId,
    accountId,
    onAddedCustomAddressCallback,
  } = props;
  const navigation = useNavigation<NavigationProps['navigation']>();

  const onPressShowPath = useCallback(() => {
    onChange?.(!showPath);
  }, [onChange, showPath]);

  const onCreateAccountByAddressIndex = useCallback(
    async ({
      password,
      derivationOption,
      addressIndex,
      account,
    }: {
      password: string;
      derivationOption?: IDerivationOption;
      addressIndex?: string;
      account?: Account;
    }) => {
      try {
        await backgroundApiProxy.serviceDerivationPath.createAccountByCustomAddressIndex(
          {
            accountId,
            networkId,
            password,
            addressIndex: addressIndex ?? '',
            account,
            template: derivationOption?.template ?? '',
          },
        );
        onAddedCustomAddressCallback();
      } catch (e) {
        deviceUtils.showErrorToast(e);
      } finally {
        navigation.goBack?.();
      }
    },
    [networkId, accountId, navigation, onAddedCustomAddressCallback],
  );

  const onPressFindAddressByPath = useCallback(() => {
    showFindAddressByPathBottomSheetModal({
      walletId,
      networkId,
      accountId,
      onConfirm: ({ data }) => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateAccount,
          params: {
            screen: CreateAccountModalRoutes.CreateAccountAuthentication,
            params: {
              walletId,
              onDone: (password) =>
                onCreateAccountByAddressIndex({ password, ...data }),
            },
          },
        });
      },
    });
  }, [
    walletId,
    networkId,
    accountId,
    navigation,
    onCreateAccountByAddressIndex,
  ]);

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

  const showFindAddressByPath = useMemo(
    () =>
      ([OnekeyNetwork.btc, OnekeyNetwork.tbtc] as string[]).includes(networkId),
    [networkId],
  );

  const options = useMemo<IBaseMenuOptions>(
    () => [
      showFindAddressByPath && {
        id: 'action__find_address_by_path',
        onPress: onPressFindAddressByPath,
        icon: 'MagnifyingGlassMini',
      },
      () => <Divider my={1} />,
      {
        id: 'action__show_path',
        onPress: onPressShowPath,
        extraChildren: showPathCheckBox,
      },
    ],
    [
      onPressShowPath,
      showPathCheckBox,
      onPressFindAddressByPath,
      showFindAddressByPath,
    ],
  );

  return <BaseMenu options={options} {...props} menuWidth={261} />;
};

export default BitcoinUsedAddressMenu;

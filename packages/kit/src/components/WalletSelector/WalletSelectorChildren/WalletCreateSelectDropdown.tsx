import type { FC, ReactNode } from 'react';
import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { ICON_NAMES } from '@onekeyhq/components';
import {
  Box,
  Center,
  Icon,
  Select,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import type {
  IDropdownProps,
  SelectItem,
} from '@onekeyhq/components/src/Select';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/engine/src/types/wallet';
import { EPasswordResStatus } from '@onekeyhq/kit-bg/src/services/ServicePassword';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigationActions } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { EOnboardingRoutes } from '../../../views/Onboarding/routes/enums';
import { useCreateAccountInWallet } from '../../NetworkAccountSelector/hooks/useCreateAccountInWallet';
import { ValidationFields } from '../../Protected';

import type { EWalletDataSectionType } from '../hooks/useWalletSelectorSectionData';

const OptionLeading: FC<{ iconName: ICON_NAMES }> = ({ iconName }) => {
  const isVerticalLayout = useIsVerticalLayout();
  return (
    <Box alignSelf="flex-start">
      {isVerticalLayout ? (
        <Center
          size="48px"
          rounded="full"
          bgColor="surface-default"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="divider"
        >
          <Icon color="interactive-default" name={iconName} size={24} />
        </Center>
      ) : (
        <Icon name={iconName} size={20} />
      )}
    </Box>
  );
};

export function WalletCreateSelectDropdown({
  renderTrigger,
  walletType,
  dropdownProps,
}: {
  dropdownProps?: IDropdownProps;
  walletType: EWalletDataSectionType;
  renderTrigger?: (options: {
    activeOption: SelectItem;
    isHovered: boolean;
    isFocused: boolean;
    isPressed: boolean;
    visible: boolean;
    onPress?: () => void;
  }) => ReactNode;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isVerticalLayout = useIsVerticalLayout();
  const { closeWalletSelector } = useNavigationActions();

  // external account create
  const externalAccountCreator = useCreateAccountInWallet({
    networkId: '',
    walletId: WALLET_TYPE_EXTERNAL,
  });

  const options = useMemo(() => {
    if (walletType === 'hd') {
      return [
        {
          leading: <OptionLeading iconName="PlusCircleOutline" />,
          label: intl.formatMessage({
            id: 'action__create_wallet' as any,
          }),
          description: intl.formatMessage({
            id: 'content__generate_new_recovery_phrase' as any,
          }),
          value: 'create',
        },
        {
          leading: <OptionLeading iconName="InboxArrowDownOutline" />,
          label: intl.formatMessage({
            id: 'action__import_wallet' as any,
          }),
          description: intl.formatMessage({
            id: 'content__import_wallet_desc' as any,
          }),
          value: 'import',
        },
        {
          leading: <OptionLeading iconName="LinkOutline" />,
          label: intl.formatMessage({
            id: 'action__connect_3rd_party_wallet' as any,
          }),
          description: intl.formatMessage({
            id: 'content__connect_3rd_party_wallet_desc' as any,
          }),
          value: 'connect',
        },
      ];
    }
    return [];
  }, [walletType, intl]);

  return (
    <Select
      onChange={async (v) => {
        if (isVerticalLayout && platformEnv.isNative) {
          closeWalletSelector();
        } else {
          setTimeout(() => {
            closeWalletSelector();
          }, 300);
        }
        if (v === 'create') {
          // navigation.navigate(RootRoutes.Onboarding, {
          //   screen: EOnboardingRoutes.SetPassword,
          //   params: {
          //     disableAnimation: true,
          //   },
          // });
          const { status, data } =
            await backgroundApiProxy.servicePassword.backgroundPromptPasswordDialog(
              {
                walletId: null,
                field: ValidationFields.Wallet,
                skipSavePassword: true,
                hideTitle: true,
                isAutoHeight: true,
              },
            );
          if (status === EPasswordResStatus.PASS_STATUS) {
            const mnemonic = await backgroundApiProxy.engine.generateMnemonic();
            navigation.navigate(RootRoutes.Onboarding, {
              screen: EOnboardingRoutes.RecoveryPhrase,
              params: {
                password: data.password,
                mnemonic,
                withEnableAuthentication:
                  data.options?.withEnableAuthentication,
              },
            });
          }
        }
        if (v === 'import') {
          navigation.navigate(RootRoutes.Onboarding, {
            screen: EOnboardingRoutes.ImportWallet,
            params: {
              disableAnimation: true,
            },
          });
        }
        if (v === 'connect') {
          if (externalAccountCreator.isCreateAccountSupported) {
            externalAccountCreator.createAccount();
          }
        }
      }}
      dropdownPosition="right"
      footer={null}
      headerShown={false}
      title={intl.formatMessage({ id: 'action__add_app_wallet' })}
      activatable={false}
      containerProps={{
        width: 'auto',
        zIndex: 5,
      }}
      dropdownProps={dropdownProps}
      options={options}
      renderTrigger={({ onPress, ...others }) => {
        const onPressTrigger = () => {
          if (walletType === 'hw') {
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.CreateWallet,
              params: {
                screen: CreateWalletModalRoutes.ConnectHardwareModal,
                params: {
                  entry: 'walletSelector',
                },
              },
            });
          } else {
            onPress?.();
          }
        };
        return renderTrigger?.({ onPress: onPressTrigger, ...others });
      }}
    />
  );
}

import React, { ReactNode, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Select, useIsVerticalLayout } from '@onekeyhq/components';
import { IDropdownProps, SelectItem } from '@onekeyhq/components/src/Select';

import { useNavigationActions } from '../../../hooks';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '../../../routes/routesEnum';
import { EOnboardingRoutes } from '../../../views/Onboarding/routes/enums';
import { EWalletDataSectionType } from '../hooks/useWalletSelectorSectionData';

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
  const isVerticalLayout = useIsVerticalLayout();
  const navigation = useAppNavigation();
  const { closeWalletSelector } = useNavigationActions();
  const options = useMemo(() => {
    if (walletType === 'hd') {
      return [
        {
          leading: (
            <Box alignSelf="flex-start">
              <Icon
                name={
                  isVerticalLayout ? 'PlusCircleOutline' : 'PlusCircleSolid'
                }
                size={isVerticalLayout ? 24 : 20}
              />
            </Box>
          ),
          label: intl.formatMessage({
            id: 'action__create_wallet' as any,
          }),
          description: intl.formatMessage({
            id: 'content__generate_new_recovery_phrase' as any,
          }),
          value: 'create',
        },
        {
          leading: (
            <Box alignSelf="flex-start">
              <Icon
                name={isVerticalLayout ? 'RestoreOutline' : 'RestoreSolid'}
                size={isVerticalLayout ? 24 : 20}
              />
            </Box>
          ),
          label: intl.formatMessage({
            id: 'action__restore_wallet' as any,
          }),
          description: intl.formatMessage({
            id: 'content__import_existing_recovery_phrase' as any,
          }),
          value: 'import',
        },
      ];
    }
    return [];
  }, [walletType, isVerticalLayout, intl]);

  return (
    <Select
      onChange={(v) => {
        setTimeout(() => {
          closeWalletSelector();
        }, 300);
        if (v === 'create') {
          navigation.navigate(RootRoutes.Onboarding, {
            screen: EOnboardingRoutes.SetPassword,
            params: {
              disableAnimation: true,
            },
          });
        }
        if (v === 'import') {
          navigation.navigate(RootRoutes.Onboarding, {
            screen: EOnboardingRoutes.ImportWallet,
            params: {
              disableAnimation: true,
            },
          });
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
            setTimeout(() => {
              closeWalletSelector();
            }, 300);
            navigation.navigate(RootRoutes.Modal, {
              screen: ModalRoutes.CreateWallet,
              params: {
                screen: CreateWalletModalRoutes.ConnectHardwareModal,
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

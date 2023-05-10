import { useCallback, useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Box,
  Button,
  HStack,
  Modal,
  ToastManager,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { copyToClipboard } from '@onekeyhq/components/src/utils/ClipboardUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { AddressBookRoutes } from '../AddressBook/routes';
import { EOnboardingRoutes } from '../Onboarding/routes/enums';
import BaseMenu from '../Overlay/BaseMenu';

import type { ModalScreenProps, RootRoutesParams } from '../../routes/types';
import type { IBaseMenuOptions, IMenu } from '../Overlay/BaseMenu';
import type { ScanQrcodeRoutes, ScanQrcodeRoutesParams } from './types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<RootRoutesParams>;

type ScanQrcodeResultRouteProp = RouteProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.ScanQrcodeResult
>;

interface Props extends IMenu {
  data: string;
}
const ScanQrcodeResultMoreMenu = (props: Props) => {
  const { data } = props;
  const navigation = useNavigation<NavigationProps['navigation']>();
  const options = useMemo(() => {
    const baseOptions: IBaseMenuOptions = [
      {
        id: 'form__add_to_address_book',
        onPress: () => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.AddressBook,
            params: {
              screen: AddressBookRoutes.NewAddressRoute,
              params: {
                address: data,
              },
            },
          });
        },
        icon: 'UserPlusOutline',
      },
      {
        id: 'form__imported_as_a_watch_account',
        onPress: () => {
          navigation.replace(RootRoutes.Onboarding, {
            screen: EOnboardingRoutes.RecoveryWallet,
            params: {
              mode: 'watching',
              presetText: data,
            },
          });
        },
        icon: 'EyeOutline',
      },
    ];
    return baseOptions;
  }, [data, navigation]);

  return <BaseMenu options={options} {...props} />;
};

const ScanQrcodeResult = () => {
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const isVertical = useIsVerticalLayout();
  const route = useRoute<ScanQrcodeResultRouteProp>();
  const { data } = route.params;

  const handleCopyInfoOnPress = useCallback(() => {
    copyToClipboard(data);
    ToastManager.show({ title: intl.formatMessage({ id: 'msg__copied' }) });
  }, [data, intl]);

  return (
    <Modal
      size={isVertical ? undefined : 'lg'}
      height="516px"
      header={intl.formatMessage({ id: 'content__info' })}
      footer={
        <Box
          borderTopColor="divider"
          pb={`${bottom}px`}
          borderTopWidth={platformEnv.isNative ? 0 : StyleSheet.hairlineWidth}
        >
          <HStack
            justifyContent="flex-end"
            py="4"
            px={isVertical ? 4 : 6}
            alignItems="center"
            space={4}
          >
            <Button
              size={isVertical ? 'xl' : 'base'}
              onPress={handleCopyInfoOnPress}
              leftIconName="Square2StackOutline"
              flex={isVertical ? 1 : undefined}
            >
              {intl.formatMessage({ id: 'action__copy' })}
            </Button>
            <ScanQrcodeResultMoreMenu
              data={data}
              placement="top left"
              width="280px"
            >
              <Button
                size={isVertical ? 'xl' : 'base'}
                leftIconName="EllipsisVerticalOutline"
                flex={isVertical ? 1 : undefined}
              >
                {intl.formatMessage({ id: 'action__more _options' })}
              </Button>
            </ScanQrcodeResultMoreMenu>
          </HStack>
        </Box>
      }
      scrollViewProps={{
        pb: `${bottom}px`,
        children: (
          <Typography.Display2XLarge wordBreak="break-all">
            {data}
          </Typography.Display2XLarge>
        ),
      }}
    />
  );
};

export default ScanQrcodeResult;

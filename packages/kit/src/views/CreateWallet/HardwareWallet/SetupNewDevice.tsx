import type { FC } from 'react';
import { useMemo } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Image, Modal, Typography } from '@onekeyhq/components';
import ClassicRestoreDevicePng from '@onekeyhq/kit/assets/wallet/restore-classic-device.png';
import MiniRestoreDevicePng from '@onekeyhq/kit/assets/wallet/restore-mini-device.png';
import TouchRestoreDevicePng from '@onekeyhq/kit/assets/wallet/restore-touch-device.png';
import ClassicSetupNewDevicePng from '@onekeyhq/kit/assets/wallet/setup-new-classic-device.png';
import MiniSetupNewDevicePng from '@onekeyhq/kit/assets/wallet/setup-new-mini-device.png';
import TouchSetupNewDevicePng from '@onekeyhq/kit/assets/wallet/setup-new-touch-device.png';
import { useHelpLink } from '@onekeyhq/kit/src/hooks';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/CreateWallet';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import type { CreateWalletModalRoutes } from '../../../routes/routesEnum';
import type { IDeviceType } from '@onekeyfe/hd-core';
import type { RouteProp } from '@react-navigation/native';

export type SetupNewDeviceType = 'SetupNew' | 'Restore';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.SetupNewDeviceModal
>;

const getSetupNewDeviceIcon = (type: IDeviceType): any => {
  switch (type) {
    case 'classic':
    case 'classic1s':
      return ClassicSetupNewDevicePng;
    case 'mini':
      return MiniSetupNewDevicePng;
    case 'touch':
    case 'pro':
      return TouchSetupNewDevicePng;
    default:
      return undefined;
  }
};

const getRestoreDeviceIcon = (type: IDeviceType): any => {
  switch (type) {
    case 'classic':
    case 'classic1s':
      return ClassicRestoreDevicePng;
    case 'mini':
      return MiniRestoreDevicePng;
    case 'touch':
    case 'pro':
      return TouchRestoreDevicePng;
    default:
      return undefined;
  }
};

const SetupNewDeviceModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const route = useRoute<RouteProps>();
  const { device, type } = route?.params || {};

  const miniActivateHelp = useHelpLink({ path: 'articles/4408289773455' });
  const classicActivateHelp = useHelpLink({ path: 'articles/360004487195' });

  const activateHelpUrl = useMemo(() => {
    if (!device) return null;
    switch (device.deviceType) {
      case 'classic':
      case 'classic1s':
        return classicActivateHelp;

      case 'mini':
        return miniActivateHelp;

      default:
        return null;
    }
  }, [classicActivateHelp, device, miniActivateHelp]);

  const numberedList = useMemo(() => {
    const hintList = [
      {
        title: intl.formatMessage({ id: 'content__set_a_pin_code' }),
        description: intl.formatMessage({ id: 'content__set_a_pin_code_desc' }),
      },
      {
        title: intl.formatMessage({ id: 'content__follow_instructions' }),
        description: intl.formatMessage({
          id: 'content__follow_instructions_desc',
        }),
      },
    ];

    if (type === 'SetupNew') {
      hintList.unshift({
        title: intl.formatMessage({
          id: 'content__write_down_all_recovery_seed',
        }),
        description: intl.formatMessage({
          id: 'content__write_down_all_recovery_seed_desc',
        }),
      });
    } else {
      hintList.unshift({
        title: intl.formatMessage({
          id: 'content__enter_your_recovery_seed',
        }),
        description: intl.formatMessage({
          id: 'content__enter_your_recovery_seed_desc',
        }),
      });
    }

    if (device.deviceType === 'touch' || device.deviceType === 'pro') {
      // 0 <=> 1
      hintList.splice(1, 1, ...hintList.splice(0, 1, hintList[1]));
    }
    return hintList;
  }, [device.deviceType, intl, type]);

  const content = (
    <>
      <Box
        bgColor="surface-neutral-subdued"
        w="full"
        h="160px"
        borderRadius="12px"
        mb={8}
      >
        <Image
          source={
            type === 'SetupNew'
              ? getSetupNewDeviceIcon(device.deviceType)
              : getRestoreDeviceIcon(device.deviceType)
          }
          w="full"
          h="full"
          resizeMode="cover"
        />
      </Box>
      <Box>
        <Typography.DisplayMedium mb={2}>
          {type === 'SetupNew'
            ? intl.formatMessage({ id: 'content__select_create_new_wallet' })
            : intl.formatMessage({ id: 'content__select_restore_wallet' })}
        </Typography.DisplayMedium>
        <Typography.Body2 color="text-subdued">
          {type === 'SetupNew'
            ? intl.formatMessage({
                id: 'content__select_create_new_wallet_desc',
              })
            : intl.formatMessage({ id: 'content__select_restore_wallet_desc' })}
        </Typography.Body2>
      </Box>

      {numberedList.map((item, index) => (
        <Box key={index} flexDirection="row" mt={4}>
          <Center rounded="full" bg="decorative-surface-one" size={8} mr={4}>
            <Typography.Body2Strong color="decorative-icon-one">
              {index + 1}
            </Typography.Body2Strong>
          </Center>
          <Box flex={1} pt={1}>
            <Typography.Body1Strong>{item.title}</Typography.Body1Strong>
            <Typography.Body2 color="text-subdued" mt={1.5}>
              {item.description}
            </Typography.Body2>
          </Box>
        </Box>
      ))}
    </>
  );

  return (
    <Modal
      header={
        type === 'SetupNew'
          ? intl.formatMessage({ id: 'modal__setup_new_device' })
          : intl.formatMessage({ id: 'modal__restore_wallet' })
      }
      height="640px"
      primaryActionTranslationId="action__ok_im_done"
      hideSecondaryAction={!activateHelpUrl}
      secondaryActionTranslationId="action__learn_more"
      onPrimaryActionPress={() => {
        navigation.popToTop();
      }}
      onSecondaryActionPress={() => {
        if (activateHelpUrl) openUrl(activateHelpUrl);
      }}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default SetupNewDeviceModal;

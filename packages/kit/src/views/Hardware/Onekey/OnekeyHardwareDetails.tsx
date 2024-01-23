import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { LinearGradient } from 'expo-linear-gradient';
import { useIntl } from 'react-intl';

import {
  Box,
  Container,
  Icon,
  Image,
  Modal,
  Pressable,
  Typography,
} from '@onekeyhq/components';
import deviceClassicIcon from '@onekeyhq/kit/assets/hardware/about/device-classic.png';
import deviceMiniIcon from '@onekeyhq/kit/assets/hardware/about/device-mini.png';
import deviceTouchIcon from '@onekeyhq/kit/assets/hardware/about/device-touch.png';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import { useAppSelector } from '@onekeyhq/kit/src/hooks';
import type { OnekeyHardwareRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/HardwareOnekey';
import {
  ModalRoutes,
  OnekeyHardwareModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import { getDeviceFirmwareVersion } from '@onekeyhq/kit/src/utils/hardware/OneKeyHardware';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal
>;

type OnekeyHardwareDetailsModalProps = {
  walletId: string;
  deviceFeatures?: IOneKeyDeviceFeatures;
};

const WrapperItem = ({ ...props }) => (
  <Container.Item {...props} px={0} py={2} />
);

const OnekeyHardwareDetails: FC<OnekeyHardwareDetailsModalProps> = ({
  walletId,
  deviceFeatures,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();

  const { serviceHardware } = backgroundApiProxy;
  const deviceVerification = useAppSelector(
    (s) => s.settings.hardware?.verification,
  );

  const [deviceUUID, setDeviceUUID] = useState<string>('-');
  const [connectId, setConnectId] = useState<string>();
  const [devicePicture, setDevicePicture] = useState<any>();

  const deviceVerifiedStatus = useMemo(() => {
    if (!deviceFeatures) return undefined;
    if (!connectId) return undefined;
    return deviceVerification?.[connectId];
  }, [connectId, deviceFeatures, deviceVerification]);

  useEffect(() => {
    if (!deviceFeatures) return;
    const setDeviceInfo = async () => {
      const { getDeviceType, getDeviceUUID } = await CoreSDKLoader();
      const $deviceType = getDeviceType(deviceFeatures);
      setDeviceUUID(getDeviceUUID(deviceFeatures));
      try {
        switch ($deviceType) {
          case 'classic':
          case 'classic1s':
            setDevicePicture(deviceClassicIcon);
            break;
          case 'mini':
            setDevicePicture(deviceMiniIcon);
            break;
          case 'touch':
            setDevicePicture(deviceTouchIcon);
            break;
          default:
            break;
        }
      } catch (error) {
        // ignore
      }
      setConnectId(
        (await serviceHardware.getConnectId(deviceFeatures)) ?? undefined,
      );
    };
    setDeviceInfo();
  }, [deviceFeatures, serviceHardware]);

  return (
    <Box alignItems="center" mb={{ base: 4, md: 0 }}>
      <Box alignItems="center" w="full" overflow="hidden">
        <Box opacity={20} w="full" position="absolute" zIndex={-1}>
          <Icon
            name="HardwareAboutDeviceBgIllus"
            height={330}
            width={330}
            color="interactive-default"
          />
        </Box>
        <Box h="160px">
          {devicePicture ? (
            <Image w="200" h="full" source={devicePicture} />
          ) : null}
        </Box>

        <LinearGradient
          colors={['rgba(92, 195, 76, 0)', '#5CC34C', 'rgba(92, 195, 76, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            height: 1,
            width: '100%',
            opacity: 0.3,
          }}
        />
      </Box>

      <Pressable
        w="100%"
        onPress={() => {
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.OnekeyHardware,
            params: {
              screen: OnekeyHardwareModalRoutes.OnekeyHardwareVerifyModal,
              params: {
                walletId,
              },
            },
          });
        }}
      >
        <Container.Item
          px={0}
          py={6}
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'action__verify' })}
          hasArrow={!deviceVerifiedStatus}
        >
          {deviceVerifiedStatus ? (
            <Box flexDirection="row" alignItems="center">
              <Typography.Body1 mr={2} color="text-success">
                {intl.formatMessage({ id: 'msg__hardware_verify_success' })}
              </Typography.Body1>
              <Icon name="CheckBadgeMini" color="text-success" size={20} />
            </Box>
          ) : null}
        </Container.Item>
      </Pressable>

      <Box bg="divider" w="100%" h="1px" mb={4} />

      <WrapperItem
        titleColor="text-default"
        describeColor="text-subdued"
        title={intl.formatMessage({ id: 'content__serial_number' })}
        describe={deviceUUID}
      />

      <WrapperItem
        titleColor="text-default"
        describeColor="text-subdued"
        title={intl.formatMessage({ id: 'content__bluetooth_name' })}
        describe={deviceFeatures?.ble_name ?? '-'}
      />

      <WrapperItem
        titleColor="text-default"
        describeColor="text-subdued"
        title={intl.formatMessage({ id: 'content__firmware_version' })}
        describe={getDeviceFirmwareVersion(deviceFeatures).join('.')}
      />

      <WrapperItem
        titleColor="text-default"
        describeColor="text-subdued"
        title={intl.formatMessage({
          id: 'content__bluetooth_firmware_version',
        })}
        describe={deviceFeatures?.ble_ver ?? '-'}
      />
    </Box>
  );
};

/**
 * 硬件详情
 */
const OnekeyHardwareDetailsModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId } = route?.params || {};

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__about_device' })}
      headerDescription=""
      footer={null}
      scrollViewProps={{
        contentContainerStyle: {
          flex: 1,
          justifyContent: 'center',
          paddingTop: 24,
          paddingBottom: 24,
        },
        children: (
          <Protected walletId={walletId}>
            {(_, { deviceFeatures }) => (
              <OnekeyHardwareDetails
                walletId={walletId}
                deviceFeatures={deviceFeatures}
              />
            )}
          </Protected>
        ),
      }}
    />
  );
};

export default OnekeyHardwareDetailsModal;

import React, { FC, useEffect, useMemo, useState } from 'react';

import { getDeviceType, getDeviceUUID } from '@onekeyfe/hd-core';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Container,
  Icon,
  Modal,
  Switch,
  ToastManager,
} from '@onekeyhq/components';
import { OneKeyErrorClassNames } from '@onekeyhq/engine/src/errors';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import Protected from '@onekeyhq/kit/src/components/Protected';
import { useSettings } from '@onekeyhq/kit/src/hooks/redux';
import {
  OnekeyHardwareModalRoutes,
  OnekeyHardwareRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/HardwareOnekey';
import { HardwareUpdateModalRoutes } from '@onekeyhq/kit/src/routes/Modal/HardwareUpdate';
import { ModalRoutes, RootRoutes } from '@onekeyhq/kit/src/routes/types';
import { getHomescreenKeys } from '@onekeyhq/kit/src/utils/hardware/constants/homescreens';
import { getDeviceFirmwareVersion } from '@onekeyhq/kit/src/utils/hardware/OneKeyHardware';
import { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import { deviceUtils } from '../../../utils/hardware';

type RouteProps = RouteProp<
  OnekeyHardwareRoutesParams,
  OnekeyHardwareModalRoutes.OnekeyHardwareDetailsModal
>;

type OnekeyHardwareDetailsModalProps = {
  walletId: string;
  deviceFeatures?: IOneKeyDeviceFeatures;
};

const OnekeyHardwareDetails: FC<OnekeyHardwareDetailsModalProps> = ({
  walletId,
  deviceFeatures,
}) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { engine, serviceHardware } = backgroundApiProxy;
  const { deviceUpdates } = useSettings();

  const [deviceConnectId, setDeviceConnectId] = useState<string>();
  const [deviceId, setDeviceId] = useState<string>();
  const [onDeviceInputPin, setOnDeviceInputPin] = useState<boolean>(true);

  const canOnDeviceInputPin = useMemo(() => {
    const deviceType = getDeviceType(deviceFeatures);
    if (deviceType === 'classic' || deviceType === 'mini') return true;
    return false;
  }, [deviceFeatures]);

  const updates = useMemo(
    () => deviceUpdates?.[deviceConnectId ?? ''],
    [deviceUpdates, deviceConnectId],
  );

  const deviceType = getDeviceType(deviceFeatures);
  const showHomescreenSetting = getHomescreenKeys(deviceType).length > 0;

  const refreshDevicePayload = () => {
    engine
      .getHWDeviceByWalletId(walletId)
      .then((device) => {
        setOnDeviceInputPin(device?.payload?.onDeviceInputPin ?? true);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  useEffect(() => {
    (async () => {
      try {
        const device = await engine.getHWDeviceByWalletId(walletId);
        setOnDeviceInputPin(device?.payload?.onDeviceInputPin ?? true);
        setDeviceConnectId(device?.mac);
        setDeviceId(device?.deviceId);
      } catch (err: any) {
        if (navigation?.canGoBack?.()) {
          navigation.goBack();
        }

        const { className, key } = err || {};
        if (className === OneKeyErrorClassNames.OneKeyHardwareError) {
          ToastManager.show(
            {
              title: intl.formatMessage({ id: key }),
            },
            { type: 'error' },
          );
        } else {
          ToastManager.show({
            title: intl.formatMessage(
              {
                id: 'action__connection_timeout',
              },
              { type: 'error' },
            ),
          });
        }
      }
    })();
  }, [engine, intl, navigation, serviceHardware, walletId]);

  return (
    <Box
      flexDirection="column"
      p={0.5}
      alignItems="center"
      mb={{ base: 4, md: 0 }}
    >
      {(updates?.ble || updates?.firmware) && (
        <Container.Box mb={4}>
          <Container.Item
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.HardwareUpdate,
                params: {
                  screen: HardwareUpdateModalRoutes.HardwareUpdateInfoModel,
                  params: {
                    walletId,
                    onSuccess: () => {
                      if (navigation?.canGoBack?.()) {
                        navigation.goBack();
                      }
                    },
                  },
                },
              });
            }}
            titleColor="text-default"
            title={intl.formatMessage({ id: 'action__update_available' })}
            subDescribeCustom={
              <Icon name="InformationCircleSolid" color="icon-success" />
            }
          />
        </Container.Box>
      )}

      <Container.Box>
        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'content__serial_number' })}
          describe={deviceFeatures ? getDeviceUUID(deviceFeatures) : '-'}
        />

        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'content__firmware_version' })}
          describe={getDeviceFirmwareVersion(deviceFeatures).join('.')}
        />

        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'content__bluetooth_name' })}
          describe={deviceFeatures?.ble_name ?? '-'}
        />

        <Container.Item
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({
            id: 'content__bluetooth_firmware_version',
          })}
          describe={deviceFeatures?.ble_ver ?? '-'}
        />

        {showHomescreenSetting && (
          <Container.Item
            titleColor="text-default"
            describeColor="text-subdued"
            title={intl.formatMessage({
              id: 'modal__homescreen',
            })}
            hasArrow
            onPress={() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.OnekeyHardware,
                params: {
                  screen:
                    OnekeyHardwareModalRoutes.OnekeyHardwareHomescreenModal,
                  params: {
                    walletId,
                    deviceType: getDeviceType(deviceFeatures),
                  },
                },
              });
            }}
          />
        )}
      </Container.Box>

      <Container.Box mt={6}>
        <Container.Item
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
          hasArrow
          titleColor="text-default"
          describeColor="text-subdued"
          title={intl.formatMessage({ id: 'action__verify' })}
        />
        {!!canOnDeviceInputPin && (
          <Container.Item
            titleColor="text-default"
            title={intl.formatMessage({
              id: 'content__enter_pin_in_app',
            })}
          >
            <Switch
              labelType="false"
              isChecked={!onDeviceInputPin}
              onToggle={() => {
                if (deviceId && deviceConnectId) {
                  const newOnDeviceInputPin = !onDeviceInputPin;
                  setOnDeviceInputPin(newOnDeviceInputPin);
                  serviceHardware
                    .setOnDeviceInputPin(
                      deviceConnectId,
                      deviceId,
                      newOnDeviceInputPin,
                    )
                    .catch((e: any) => {
                      deviceUtils.showErrorToast(e, intl);
                    })
                    .finally(() => {
                      refreshDevicePayload();
                    });
                }
              }}
            />
          </Container.Item>
        )}
      </Container.Box>
    </Box>
  );
};

/**
 * 硬件详情
 */
const OnekeyHardwareDetailsModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { walletId } = route?.params;

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__view_device_details' })}
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

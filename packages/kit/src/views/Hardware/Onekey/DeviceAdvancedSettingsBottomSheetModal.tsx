import { useCallback, useEffect, useMemo, useState } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import {
  BottomSheetModal,
  Box,
  Container,
  Spinner,
  Switch,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import { showOverlay } from '@onekeyhq/kit/src/utils/overlayUtils';
import { CoreSDKLoader } from '@onekeyhq/shared/src/device/hardwareInstance';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types';

import DisablePassphraseDialog from './DisablePassphraseDialog';
import EnablePassphraseDialog from './EnablePassphraseDialog';

import type { IDeviceType } from '@onekeyfe/hd-core';

function DeviceAdvancedSettings({
  walletId,
  deviceId,
  deviceConnectId,
  deviceType,
  deviceFeatures,
}: {
  walletId: string;
  deviceId: string;
  deviceConnectId: string;
  deviceType: IDeviceType | undefined;
  deviceFeatures: IOneKeyDeviceFeatures;
  closeOverlay: () => void;
}) {
  const intl = useIntl();
  const { engine, serviceHardware } = backgroundApiProxy;
  const [onDeviceInputPin, setOnDeviceInputPin] = useState<boolean>(true);
  const [enableDevicePassphrase, setEnableDevicePassphrase] =
    useState<boolean>(false);

  const canOnDeviceInputPin = useMemo(() => {
    if (
      deviceType === 'classic' ||
      deviceType === 'classic1s' ||
      deviceType === 'mini'
    )
      return true;
    return false;
  }, [deviceType]);

  const refreshDevicePayload = () => {
    engine
      .getHWDeviceByWalletId(walletId)
      .then((device) => {
        setOnDeviceInputPin(device?.payload?.onDeviceInputPin ?? false);
      })
      .catch((err) => {
        console.log(err);
      });
  };

  useEffect(() => {
    setEnableDevicePassphrase(deviceFeatures.passphrase_protection === true);
  }, [deviceFeatures.passphrase_protection]);

  useEffect(() => {
    refreshDevicePayload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTogglePassphrase = useCallback(() => {
    if (deviceId && deviceConnectId) {
      const oldEnableDevicePassphrase = enableDevicePassphrase;
      const newEnableDevicePassphrase = !enableDevicePassphrase;

      showOverlay((onCloseOverlay) => {
        if (oldEnableDevicePassphrase) {
          return (
            <DisablePassphraseDialog
              deviceConnectId={deviceConnectId}
              onClose={onCloseOverlay}
              onSuccess={() => {
                setEnableDevicePassphrase(newEnableDevicePassphrase);
                onCloseOverlay();
              }}
              onError={onCloseOverlay}
            />
          );
        }

        return (
          <EnablePassphraseDialog
            deviceConnectId={deviceConnectId}
            onClose={onCloseOverlay}
            onSuccess={() => {
              setEnableDevicePassphrase(newEnableDevicePassphrase);
              onCloseOverlay();
            }}
            onError={onCloseOverlay}
          />
        );
      });
    }
  }, [deviceConnectId, deviceId, enableDevicePassphrase]);

  return (
    <Box>
      {!!canOnDeviceInputPin && (
        <Container.Item
          titleColor="text-default"
          title={intl.formatMessage({
            id: 'content__enter_pin_in_app',
          })}
          px={0}
          py={3}
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
                    deviceUtils.showErrorToast(e);
                  })
                  .finally(() => {
                    refreshDevicePayload();
                  });
              }
            }}
          />
        </Container.Item>
      )}
      <Container.Item
        titleColor="text-default"
        title={intl.formatMessage({ id: 'action__passphrase' })}
        px={0}
        py={3}
      >
        <Switch
          labelType="false"
          isChecked={enableDevicePassphrase}
          onToggle={onTogglePassphrase}
        />
      </Container.Item>

      <Typography.Body2 color="text-subdued">
        {intl.formatMessage({ id: 'msg__passphrase_open_dsc' })}
      </Typography.Body2>
    </Box>
  );
}

function DeviceAdvancedSettingsBottomSheetModal({
  walletId,
  deviceType,
  closeOverlay,
}: {
  walletId: string;
  deviceType: IDeviceType | undefined;
  closeOverlay: () => void;
}) {
  const intl = useIntl();
  const isVertical = useIsVerticalLayout();
  const { engine, serviceHardware } = backgroundApiProxy;

  const [deviceConnectId, setDeviceConnectId] = useState<string>();
  const [deviceId, setDeviceId] = useState<string>();
  const [deviceFeatures, setDeviceFeatures] = useState<IOneKeyDeviceFeatures>();

  const isModeTouch = useCallback(
    async (features: IOneKeyDeviceFeatures | undefined) => {
      const { getDeviceType } = await CoreSDKLoader();
      const currentDeviceType = getDeviceType(features);
      return currentDeviceType === 'touch' || currentDeviceType === 'pro';
    },
    [],
  );

  useEffect(() => {
    (async () => {
      try {
        const device = await engine.getHWDeviceByWalletId(walletId);
        if (!device) return;
        const connectId = device?.mac;
        setDeviceConnectId(device?.mac);
        setDeviceId(device?.deviceId);

        let features: IOneKeyDeviceFeatures | undefined;
        let locked = true;
        try {
          // Prevent connection status conflict with check
          features = await serviceHardware.getFeatures(connectId);
          const isModeT = await isModeTouch(features);
          locked = features?.unlocked === false && isModeT;
        } catch (error) {
          // @ts-expect-error
          const { code } = error || {};
          if (code !== HardwareErrorCode.PollingStop) throw error;
        }

        await serviceHardware.unlockDevice(connectId);

        if (!features || locked) {
          features = await serviceHardware.getFeatures(connectId);
        }
        setDeviceFeatures(features);
      } catch (error) {
        // @ts-expect-error
        const { code } = error || {};
        if (code === HardwareErrorCode.PollingStop) return;

        closeOverlay();
        deviceUtils.showErrorToast(error, 'action__connection_timeout');
      }
    })();
  }, [closeOverlay, engine, isModeTouch, serviceHardware, walletId]);

  return (
    <BottomSheetModal
      closeOverlay={closeOverlay}
      showCloseButton={!isVertical}
      title={intl.formatMessage({ id: 'content__advanced' })}
    >
      {deviceId && deviceConnectId && deviceFeatures ? (
        <DeviceAdvancedSettings
          walletId={walletId}
          deviceId={deviceId}
          deviceConnectId={deviceConnectId}
          deviceType={deviceType}
          deviceFeatures={deviceFeatures}
          closeOverlay={closeOverlay}
        />
      ) : (
        <Box justifyContent="center" alignItems="center">
          <Spinner size="lg" />
          <Typography.DisplayMedium mt={8} mb={8}>
            {intl.formatMessage({ id: 'modal__device_status_check' })}
          </Typography.DisplayMedium>
        </Box>
      )}
    </BottomSheetModal>
  );
}

const showDeviceAdvancedSettings = ({
  walletId,
  deviceType,
}: {
  walletId: string;
  deviceType: IDeviceType | undefined;
}) => {
  showOverlay((close) => (
    <DeviceAdvancedSettingsBottomSheetModal
      walletId={walletId}
      deviceType={deviceType}
      closeOverlay={close}
    />
  ));
};

export default showDeviceAdvancedSettings;

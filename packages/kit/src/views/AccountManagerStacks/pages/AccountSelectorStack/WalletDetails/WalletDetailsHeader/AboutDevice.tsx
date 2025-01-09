import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, IconButton, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IOneKeyDeviceFeatures } from '@onekeyhq/shared/types/device';

function DescriptionList({
  label,
  description,
}: {
  label: string;
  description: string;
}) {
  return (
    <XStack justifyContent="space-between" alignItems="center" minHeight="$9">
      <SizableText textAlign="right" color="$textSubdued" size="$bodyMd">
        {label}
      </SizableText>
      <SizableText size="$bodyMdMedium">{description}</SizableText>
    </XStack>
  );
}

type IDeviceInfo = {
  uuid?: string;
  bleName?: string;
  firmwareVersion?: string;
  bleVersion?: string;
};

let lastFetchTime = 0;
export function AboutDeviceInfo({
  device,
}: {
  device?: IDBDevice | undefined;
}) {
  const intl = useIntl();
  const [deviceInfo, setDeviceInfo] = useState<
    Array<{ label: string; description: string }>
  >([]);

  const createDeviceInfo = useCallback(
    (data: IDeviceInfo) => [
      {
        label: intl.formatMessage({ id: ETranslations.global_serial_number }),
        description: data.uuid || '--',
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_bluetooth }),
        description: data.bleName || '--',
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_firmware }),
        description: data.firmwareVersion || '--',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.global_bluetooth_firmware,
        }),
        description: data.bleVersion || '--',
      },
    ],
    [intl],
  );

  const convertDeviceVersionToInfo = useCallback(
    async (data: IDBDevice, features?: IOneKeyDeviceFeatures) => {
      const { bleVersion, firmwareVersion } =
        await deviceUtils.getDeviceVersion({
          device: data,
          features,
        });

      return createDeviceInfo({
        uuid: data?.uuid,
        bleName: features?.ble_name,
        firmwareVersion,
        bleVersion,
      });
    },
    [createDeviceInfo],
  );

  const throttledGetFeaturesWithoutCache = useCallback(
    (params: { dbDevice: IDBDevice; connectId: string }) => {
      const now = Date.now();
      const throttleTime = timerUtils.getTimeDurationMs({ seconds: 5 });
      if (now - lastFetchTime < throttleTime) {
        return null;
      }
      lastFetchTime = now;
      return backgroundApiProxy.serviceHardware.getAboutDeviceFeatures({
        connectId: params.connectId,
      });
    },
    [],
  );

  useEffect(() => {
    const fetchUpdatedInfo = async () => {
      if (!device?.featuresInfo || !device?.connectId) return;

      const dbDevice = await backgroundApiProxy.serviceAccount.getDevice({
        dbDeviceId: device.id,
      });

      const initialInfo = await convertDeviceVersionToInfo(
        dbDevice,
        dbDevice?.featuresInfo,
      );
      setDeviceInfo(initialInfo);

      try {
        const features = await throttledGetFeaturesWithoutCache({
          dbDevice,
          connectId: device.connectId,
        });

        if (!features) {
          // Throttle get features
          return;
        }

        const updatedInfo = await convertDeviceVersionToInfo(
          dbDevice,
          features,
        );

        // Compare new data with current state
        const hasChanged =
          JSON.stringify(updatedInfo) !== JSON.stringify(initialInfo);

        if (hasChanged) {
          setDeviceInfo(updatedInfo);
        }
      } catch (error) {
        console.error('Error fetching updated device info:', error);
      } finally {
        //
      }
    };

    void fetchUpdatedInfo();
  }, [device, throttledGetFeaturesWithoutCache, convertDeviceVersionToInfo]);

  return (
    <>
      {deviceInfo.map((item) => (
        <DescriptionList
          key={item.label}
          label={item.label}
          description={item.description}
        />
      ))}
    </>
  );
}

export function AboutDevice({ device }: { device?: IDBDevice | undefined }) {
  const intl = useIntl();

  return (
    <IconButton
      title={intl.formatMessage({ id: ETranslations.global_about })}
      icon="InfoCircleOutline"
      variant="tertiary"
      onPress={() =>
        Dialog.show({
          title: intl.formatMessage({ id: ETranslations.global_about }),
          showFooter: false,
          renderContent: <AboutDeviceInfo device={device} />,
        })
      }
    />
  );
}

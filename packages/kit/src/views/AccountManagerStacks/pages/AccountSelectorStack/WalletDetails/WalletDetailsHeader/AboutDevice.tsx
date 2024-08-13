import { useCallback, useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, IconButton, SizableText, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

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

  useEffect(() => {
    let isLoading = false;
    const fetchUpdatedInfo = async () => {
      if (!device?.featuresInfo || !device?.connectId) return;

      const dbDevice = await backgroundApiProxy.serviceAccount.getDevice({
        dbDeviceId: device.id,
      });

      const { bleVersion, firmwareVersion } =
        await deviceUtils.getDeviceVersion({
          device: dbDevice,
          features: dbDevice?.featuresInfo,
        });

      const initialInfo = createDeviceInfo({
        uuid: dbDevice?.uuid,
        bleName: dbDevice?.featuresInfo?.ble_name,
        firmwareVersion,
        bleVersion,
      });
      setDeviceInfo(initialInfo);

      try {
        isLoading = true;
        const features =
          await backgroundApiProxy.serviceHardware.getFeaturesWithoutCache({
            connectId: device.connectId,
            params: { retryCount: 1 },
          });

        const {
          bleVersion: newBleVersion,
          firmwareVersion: newFirmwareVersion,
        } = await deviceUtils.getDeviceVersion({
          device,
          features,
        });

        const updatedInfo = createDeviceInfo({
          uuid: dbDevice.uuid,
          bleName: features.ble_name,
          firmwareVersion: newFirmwareVersion,
          bleVersion: newBleVersion,
        });

        // Compare new data with current state
        const hasChanged =
          JSON.stringify(updatedInfo) !== JSON.stringify(initialInfo);

        if (hasChanged) {
          setDeviceInfo(updatedInfo);
        }
      } catch (error) {
        console.error('Error fetching updated device info:', error);
      } finally {
        isLoading = false;
      }
    };

    void fetchUpdatedInfo();

    return () => {
      if (isLoading && device?.connectId) {
        void backgroundApiProxy.serviceHardware.cancel(device.connectId);
      }
    };
  }, [device, createDeviceInfo]);

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

import { Dialog, IconButton, SizableText, XStack } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
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
export function AboutDevice({ device }: { device?: IDBDevice | undefined }) {
  const { result: listData = [] } = usePromiseResult(async () => {
    const featuresInfo = device?.featuresInfo;
    if (!featuresInfo) {
      return [];
    }
    const { bleVersion, firmwareVersion, bootloaderVersion } =
      await deviceUtils.getDeviceVersion({
        device,
        features: device.featuresInfo,
      });
    return [
      {
        label: 'Serial Number',
        description: device.uuid || '--',
      },
      {
        label: 'Bluetooth Name',
        description: featuresInfo.ble_name || '--',
      },
      {
        label: 'Firmware Version',
        description: firmwareVersion || '--',
      },
      {
        label: 'Bluetooth Firmware Version',
        description: bleVersion || '--',
      },
      {
        label: 'Bootloader Version',
        description: bootloaderVersion || '--',
      },
    ];
  }, [device]);
  return (
    <IconButton
      title="About"
      icon="InfoCircleOutline"
      variant="tertiary"
      onPress={() =>
        Dialog.show({
          title: 'About',
          showFooter: false,
          renderContent: (
            <>
              {listData.map((item) => (
                <DescriptionList
                  key={item.label}
                  label={item.label}
                  description={item.description}
                />
              ))}
            </>
          ),
        })
      }
    />
  );
}

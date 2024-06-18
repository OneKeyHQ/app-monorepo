import { useIntl } from 'react-intl';

import { Dialog, IconButton, SizableText, XStack } from '@onekeyhq/components';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
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
export function AboutDevice({ device }: { device?: IDBDevice | undefined }) {
  const intl = useIntl();

  const { result: listData = [] } = usePromiseResult(async () => {
    const featuresInfo = device?.featuresInfo;
    if (!featuresInfo) {
      return [];
    }
    const { bleVersion, firmwareVersion } = await deviceUtils.getDeviceVersion({
      device,
      features: device.featuresInfo,
    });
    return [
      {
        label: intl.formatMessage({ id: ETranslations.global_serial_number }),
        description: device.uuid || '--',
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_bluetooth }),
        description: featuresInfo.ble_name || '--',
      },
      {
        label: intl.formatMessage({ id: ETranslations.global_firmware }),
        description: firmwareVersion || '--',
      },
      {
        label: intl.formatMessage({
          id: ETranslations.global_bluetooth_firmware,
        }),
        description: bleVersion || '--',
      },
    ];
  }, [device, intl]);
  return (
    <IconButton
      title={intl.formatMessage({ id: ETranslations.global_about })}
      icon="InfoCircleOutline"
      variant="tertiary"
      onPress={() =>
        Dialog.show({
          title: intl.formatMessage({ id: ETranslations.global_about }),
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

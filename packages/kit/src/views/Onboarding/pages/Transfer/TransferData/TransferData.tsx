import { useIntl } from 'react-intl';

import { Icon, Page, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DeviceItem } from './components/DeviceItem';

const deviceData = {
  source: {
    deviceName: "Franco's Pixel 8",
    deviceType: 'Mobile',
    iconName: 'PhoneOutline' as const,
    isCurrentDevice: true,
  },
  target: {
    deviceName: "Franco's macbook",
    deviceType: 'Laptop',
    iconName: 'LaptopOutline' as const,
  },
} as const;

export function TransferData() {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header title="Transfer Data" />
      <Page.Body>
        <Stack p="$5" gap="$3.5">
          <SizableText color="$textSubdued" size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.global_from,
            })}
          </SizableText>

          <DeviceItem {...deviceData.source} />

          <Icon
            name="SwitchVerOutline"
            size="$5"
            px="$5"
            color="$iconSubdued"
          />

          <SizableText color="$textSubdued" size="$bodyLgMedium">
            {intl.formatMessage({
              id: ETranslations.global_to,
            })}
          </SizableText>

          <DeviceItem {...deviceData.target} />
        </Stack>
      </Page.Body>
      <Page.Footer onConfirm={() => {}} onConfirmText="Transfer" />
    </Page>
  );
}

export default TransferData;

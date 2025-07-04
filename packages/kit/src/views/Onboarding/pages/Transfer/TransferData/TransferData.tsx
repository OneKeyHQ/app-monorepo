import { useIntl } from 'react-intl';

import { Icon, Page, SizableText, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes/onboarding';

import { DeviceItem } from './components/DeviceItem';
import { WaitingTransferCompleteAlert } from './components/WaitingAlert';

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
  const appNavigation = useAppNavigation();

  return (
    <Page>
      <Page.Header title="TransferData" />
      <Page.Body>
        <Stack p="$5" gap="$3.5">
          <Stack gap="$1">
            <SizableText color="$textSubdued" size="$bodyLgMedium">
              {intl.formatMessage({
                id: ETranslations.global_from,
              })}
            </SizableText>

            <DeviceItem {...deviceData.source} />
          </Stack>

          <Icon
            name="SwitchVerOutline"
            size="$5"
            px="$5"
            color="$iconSubdued"
          />

          <Stack gap="$1">
            <SizableText color="$textSubdued" size="$bodyLgMedium">
              {intl.formatMessage({
                id: ETranslations.global_to,
              })}
            </SizableText>

            <DeviceItem {...deviceData.target} />
          </Stack>

          <WaitingTransferCompleteAlert />
        </Stack>
      </Page.Body>
      <Page.Footer
        onConfirm={() => {
          appNavigation.navigate(EOnboardingPages.TransferPreview);
        }}
        onConfirmText={intl.formatMessage({
          id: ETranslations.global_transfer,
        })}
      />
    </Page>
  );
}

export default TransferData;

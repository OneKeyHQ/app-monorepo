import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Page, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { DeviceAvatarWithColor } from '../../../components/DeviceAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';

export function FirmwareUpdatePageHeaderTitle(props: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const { result } = props;
  if (!result) {
    return null;
  }
  return (
    <XStack ai="center" gap={6}>
      <DeviceAvatarWithColor
        size="$6"
        deviceType={result.deviceType || EDeviceType.Unknown}
        features={result.features}
      />
      <SizableText size="$headingMd">{result.deviceName}</SizableText>
      <SizableText size="$bodyLg" color="$textSubdued">
        {result.deviceBleName}
      </SizableText>
    </XStack>
  );
}

export function FirmwareUpdatePageHeader({
  headerTitle,
}: {
  headerTitle?: React.ReactNode;
}) {
  const intl = useIntl();
  return (
    <Page.Header
      dismissOnOverlayPress={false}
      title={
        headerTitle
          ? undefined
          : intl.formatMessage({
              id: ETranslations.update_hardware_update,
            })
      }
      headerTitle={headerTitle ? () => headerTitle : undefined}
    />
  );
}

export const FirmwareUpdatePageFooter = Page.Footer;

export function FirmwareUpdatePageLayout({
  children,
  headerTitle,
  containerStyle,
}: {
  children: React.ReactNode;
  headerTitle?: React.ReactNode;
  containerStyle?: IStackProps;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  // () => navigation.popStack()

  return (
    <Stack>
      <FirmwareUpdatePageHeader headerTitle={headerTitle} />
      <Page.Body>
        <Stack p="$5" {...containerStyle}>
          {children}
        </Stack>
      </Page.Body>
    </Stack>
  );
}

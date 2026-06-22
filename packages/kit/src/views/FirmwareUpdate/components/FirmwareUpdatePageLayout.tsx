import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Page, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { DeviceAvatarWithColor } from '../../../components/DeviceAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { getTargetFirmwareTypeLabel } from '../utils';

export function FirmwareUpdatePageHeaderTitle(props: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  const { result } = props;
  if (!result) {
    return null;
  }

  let title;
  const updateFirmwareInfo = result?.updateInfos?.firmware;
  if (
    updateFirmwareInfo?.fromFirmwareType !== undefined &&
    updateFirmwareInfo?.toFirmwareType !== undefined &&
    updateFirmwareInfo?.fromFirmwareType !== updateFirmwareInfo?.toFirmwareType
  ) {
    title = intl.formatMessage(
      {
        id: ETranslations.device_settings_switch_firmware_type,
      },
      {
        type: getTargetFirmwareTypeLabel({
          firmwareType: updateFirmwareInfo?.toFirmwareType,
          intl,
        }),
      },
    );
  } else {
    title = result.deviceName;
  }
  return (
    <XStack ai="center" gap={6} flex={1} minWidth={0}>
      <Stack flexShrink={0}>
        <DeviceAvatarWithColor
          size="$6"
          deviceType={result.deviceType || EDeviceType.Unknown}
          features={result.features}
        />
      </Stack>
      <SizableText
        size="$headingMd"
        minWidth={0}
        flexShrink={1}
        numberOfLines={1}
      >
        {title}
      </SizableText>
      <SizableText
        size="$bodyLg"
        color="$textSubdued"
        flexShrink={0}
        numberOfLines={1}
      >
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

import { EDeviceType } from '@onekeyfe/hd-shared';
import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import type {
  IStackNavigationOptions,
  IStackProps,
} from '@onekeyhq/components';
import { Page, SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ICheckAllFirmwareReleaseResult } from '@onekeyhq/shared/types/device';

import { DeviceAvatarWithColor } from '../../../components/DeviceAvatar';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { getTargetFirmwareTypeLabel } from '../utils';

export function FirmwareUpdatePageHeaderTitle(props: {
  result: ICheckAllFirmwareReleaseResult | undefined;
}) {
  const intl = useIntl();
  const { width: windowWidth } = useWindowDimensions();
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
  if (platformEnv.isNativeIOS) {
    const titleWidth = Math.max(0, windowWidth - 220);

    return (
      <XStack ai="center" gap={6} flex={1} minWidth={0}>
        <Stack flexShrink={0}>
          <DeviceAvatarWithColor
            size="$6"
            deviceType={result.deviceType || EDeviceType.Unknown}
            features={result.features}
          />
        </Stack>
        <Stack width={titleWidth} minWidth={0}>
          <SizableText size="$headingMd" numberOfLines={2}>
            {title}
          </SizableText>
        </Stack>
      </XStack>
    );
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
  headerRight,
}: {
  headerTitle?: React.ReactNode;
  headerRight?: IStackNavigationOptions['headerRight'];
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
      headerRight={headerRight}
      headerRightNoGlass={platformEnv.isNativeIOS && Boolean(headerRight)}
    />
  );
}

export const FirmwareUpdatePageFooter = Page.Footer;

export function FirmwareUpdatePageLayout({
  children,
  headerTitle,
  headerRight,
  containerStyle,
}: {
  children: React.ReactNode;
  headerTitle?: React.ReactNode;
  headerRight?: IStackNavigationOptions['headerRight'];
  containerStyle?: IStackProps;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  // () => navigation.popStack()

  return (
    <Stack>
      <FirmwareUpdatePageHeader
        headerTitle={headerTitle}
        headerRight={headerRight}
      />
      <Page.Body>
        <Stack p="$5" {...containerStyle}>
          {children}
        </Stack>
      </Page.Body>
    </Stack>
  );
}

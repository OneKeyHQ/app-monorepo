import { Anchor, Badge, Icon, SizableText, XStack } from '@onekeyhq/components';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';

import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';

import type { EFirmwareType } from '@onekeyfe/hd-shared';

export function FirmwareVersionProgressBar({
  fromVersion = '',
  toVersion = '',
}: {
  fromVersion?: string;
  toVersion?: string;
}) {
  const { versionValid, unknownMessage } = useFirmwareVersionValid();
  return (
    <XStack gap="$2.5" alignItems="center">
      <Badge badgeType="default" badgeSize="lg">
        {versionValid(fromVersion) ? fromVersion : unknownMessage}
      </Badge>
      <Icon name="ArrowRightSolid" size="$4" />
      <Badge badgeType="info" badgeSize="lg">
        {toVersion?.length > 0 ? toVersion : unknownMessage}
      </Badge>
    </XStack>
  );
}

export function FirmwareVersionProgressText({
  fromVersion = '',
  fromFirmwareType = undefined,
  toVersion = '',
  toFirmwareType = undefined,
  githubReleaseUrl = '',
  active,
}: {
  fromVersion?: string;
  fromFirmwareType?: EFirmwareType;
  toVersion?: string;
  toFirmwareType?: EFirmwareType;
  githubReleaseUrl?: string;
  active: boolean;
}) {
  const { versionValid, unknownMessage } = useFirmwareVersionValid();

  const formatLabel = (firmwareType?: EFirmwareType) =>
    deviceUtils.getFirmwareTypeLabelByFirmwareType({
      firmwareType,
      returnUniversal: true,
      displayFormat: 'withSpace',
    });

  const fromFirmwareTypeStr = formatLabel(fromFirmwareType);
  const toFirmwareTypeStr = formatLabel(toFirmwareType);

  return (
    <>
      <SizableText
        size="$bodyLgMedium"
        color={active ? '$text' : '$textSubdued'}
      >
        {versionValid(fromVersion)
          ? `${fromFirmwareTypeStr}${fromVersion}`
          : unknownMessage}
      </SizableText>
      <Icon
        name="ArrowRightSolid"
        size="$4"
        color={active ? '$text' : '$textSubdued'}
      />
      {githubReleaseUrl ? (
        <Anchor
          href={githubReleaseUrl}
          color="$textSuccess"
          size="$bodyLgMedium"
          target="_blank"
          textDecorationLine="underline"
          onPress={(e) => {
            e.stopPropagation();
          }}
        >
          {toVersion?.length > 0
            ? `${toFirmwareTypeStr}${toVersion}`
            : unknownMessage}
        </Anchor>
      ) : (
        <SizableText
          size="$bodyLgMedium"
          color={active ? '$text' : '$textSubdued'}
        >
          {toVersion?.length > 0
            ? `${toFirmwareTypeStr}${toVersion}`
            : unknownMessage}
        </SizableText>
      )}
    </>
  );
}

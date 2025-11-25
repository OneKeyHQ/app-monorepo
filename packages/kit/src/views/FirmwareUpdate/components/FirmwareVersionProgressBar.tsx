import { EFirmwareType } from '@onekeyfe/hd-shared';

import { Anchor, Badge, Icon, SizableText, XStack } from '@onekeyhq/components';

import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';

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

  let fromFirmwareTypeStr = '';
  if (fromFirmwareType === EFirmwareType.BitcoinOnly) {
    fromFirmwareTypeStr = 'Bitcoin Only ';
  } else if (fromFirmwareType === EFirmwareType.Universal) {
    fromFirmwareTypeStr = 'Universal ';
  }

  let toFirmwareTypeStr = '';
  if (toFirmwareType === EFirmwareType.BitcoinOnly) {
    toFirmwareTypeStr = 'Bitcoin Only ';
  } else if (toFirmwareType === EFirmwareType.Universal) {
    toFirmwareTypeStr = 'Universal ';
  }

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

import { useIntl } from 'react-intl';

import { Anchor, Badge, Icon, SizableText, XStack } from '@onekeyhq/components';

import { useFirmwareVersionValid } from '../hooks/useFirmwareVersionValid';
import { getTargetFirmwareTypeLabel } from '../utils';

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
    <XStack gap="$2.5" alignItems="center" minWidth={0} flexWrap="wrap">
      <Badge badgeType="default" badgeSize="lg" flexShrink={1} minWidth={0}>
        {versionValid(fromVersion) ? fromVersion : unknownMessage}
      </Badge>
      <Icon name="ArrowRightSolid" size="$4" flexShrink={0} />
      <Badge badgeType="info" badgeSize="lg" flexShrink={1} minWidth={0}>
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
  const intl = useIntl();

  const formatLabel = (firmwareType?: EFirmwareType) =>
    getTargetFirmwareTypeLabel({ firmwareType, intl });
  const formatVersionText = (
    firmwareType: EFirmwareType | undefined,
    version: string,
  ) => [formatLabel(firmwareType), version].filter(Boolean).join(' ');

  const textColor = active ? '$text' : '$textSubdued';
  const versionTextProps = {
    size: '$bodyLgMedium',
    minWidth: 0,
    flexShrink: 1,
    numberOfLines: 1,
  } as const;
  const fromVersionText = versionValid(fromVersion)
    ? formatVersionText(fromFirmwareType, fromVersion)
    : unknownMessage;
  const toVersionText =
    toVersion?.length > 0
      ? formatVersionText(toFirmwareType, toVersion)
      : unknownMessage;

  return (
    <XStack
      alignItems="center"
      gap="$1.5"
      minWidth={0}
      flexShrink={1}
      flexWrap="wrap"
    >
      <SizableText {...versionTextProps} color={textColor}>
        {fromVersionText}
      </SizableText>
      <Icon name="ArrowRightSolid" size="$4" color={textColor} flexShrink={0} />
      {githubReleaseUrl ? (
        <Anchor
          {...versionTextProps}
          href={githubReleaseUrl}
          color="$textSuccess"
          target="_blank"
          textDecorationLine="underline"
          onPress={(e) => {
            e.stopPropagation();
          }}
        >
          {toVersionText}
        </Anchor>
      ) : (
        <SizableText {...versionTextProps} color={textColor}>
          {toVersionText}
        </SizableText>
      )}
    </XStack>
  );
}

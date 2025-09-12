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
  toVersion = '',
  githubReleaseUrl = '',
  active,
}: {
  fromVersion?: string;
  toVersion?: string;
  githubReleaseUrl?: string;
  active: boolean;
}) {
  const { versionValid, unknownMessage } = useFirmwareVersionValid();
  return (
    <>
      <SizableText
        size="$bodyLgMedium"
        color={active ? '$text' : '$textSubdued'}
      >
        {versionValid(fromVersion) ? fromVersion : unknownMessage}
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
          {toVersion?.length > 0 ? toVersion : unknownMessage}
        </Anchor>
      ) : (
        <SizableText
          size="$bodyLgMedium"
          color={active ? '$text' : '$textSubdued'}
        >
          {toVersion?.length > 0 ? toVersion : unknownMessage}
        </SizableText>
      )}
    </>
  );
}

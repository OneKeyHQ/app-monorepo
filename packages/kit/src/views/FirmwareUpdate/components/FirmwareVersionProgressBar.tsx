import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import semver from 'semver';

import { Anchor, Badge, Icon, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function FirmwareVersionProgressBar({
  fromVersion = '',
  toVersion = '',
}: {
  fromVersion?: string;
  toVersion?: string;
}) {
  const intl = useIntl();
  const unknownMessage = intl.formatMessage({
    id: ETranslations.global_unknown,
  });

  const versionValid = useCallback((version: string | undefined) => {
    if (!version) return false;
    if (semver.valid(version)) {
      if (semver.eq(version, '0.0.0')) {
        return false;
      }
      return true;
    }
    return false;
  }, []);

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
  const intl = useIntl();
  const unknownMessage = intl.formatMessage({
    id: ETranslations.global_unknown,
  });

  const versionValid = useCallback((version: string | undefined) => {
    if (!version) return false;
    if (semver.valid(version)) {
      if (semver.eq(version, '0.0.0')) {
        return false;
      }
      return true;
    }
    return false;
  }, []);

  return (
    <>
      <SizableText
        size="$bodyLgMedium"
        color={active ? '$text' : '$textSubdued'}
      >
        {versionValid(fromVersion) ? fromVersion : unknownMessage}
      </SizableText>
      <Icon name="ArrowRightSolid" size="$4" color="$text" />
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

import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import semver from 'semver';

import { Badge, Icon, XStack } from '@onekeyhq/components';
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
    <XStack space="$2.5" alignItems="center">
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

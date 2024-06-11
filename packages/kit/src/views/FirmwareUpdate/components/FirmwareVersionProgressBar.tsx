import { useIntl } from 'react-intl';

import { Badge, Icon, XStack } from '@onekeyhq/components';

export function FirmwareVersionProgressBar({
  fromVersion = '',
  toVersion = '',
}: {
  fromVersion?: string;
  toVersion?: string;
}) {
  const intl = useIntl();
  const unknownMessage = intl.formatMessage({ id: 'global.unknown' });
  return (
    <XStack space="$2.5" alignItems="center">
      <Badge badgeType="default" badgeSize="lg">
        {fromVersion?.length > 0 ? fromVersion : unknownMessage}
      </Badge>
      <Icon name="ArrowRightSolid" size="$4" />
      <Badge badgeType="info" badgeSize="lg">
        {toVersion?.length > 0 ? toVersion : unknownMessage}
      </Badge>
    </XStack>
  );
}

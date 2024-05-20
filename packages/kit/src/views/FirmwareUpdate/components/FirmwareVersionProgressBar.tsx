import { Badge, Icon, XStack } from '@onekeyhq/components';

export function FirmwareVersionProgressBar({
  fromVersion = '',
  toVersion = '',
}: {
  fromVersion?: string;
  toVersion?: string;
}) {
  return (
    <XStack space="$2.5" alignItems="center">
      <Badge badgeType="default" badgeSize="lg">
        {fromVersion}
      </Badge>
      <Icon name="ArrowRightSolid" size="$4" />
      <Badge badgeType="info" badgeSize="lg">
        {toVersion}
      </Badge>
    </XStack>
  );
}

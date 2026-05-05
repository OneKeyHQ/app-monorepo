import type { IBadgeType } from '@onekeyhq/components';
import { Badge, Stack } from '@onekeyhq/components';

type IHardwareRecordStatus =
  | 'Completed'
  | 'Pending'
  | 'Undistributed'
  | 'Refunded';

interface IHardwareRecordStatusBadgeProps {
  status: string;
  statusLabel?: string;
}

const statusToBadgeType: Record<IHardwareRecordStatus, IBadgeType> = {
  Completed: 'success',
  Pending: 'warning',
  Undistributed: 'info',
  Refunded: 'default',
};

const badgeTypeToIconColor: Record<IBadgeType, string> = {
  success: '$iconSuccess',
  warning: '$iconCaution',
  info: '$iconInfo',
  critical: '$iconCritical',
  default: '$iconSubdued',
};

export function HardwareRecordStatusBadge({
  status,
  statusLabel,
}: IHardwareRecordStatusBadgeProps) {
  const badgeType =
    statusToBadgeType[status as IHardwareRecordStatus] || 'default';
  const displayLabel = statusLabel || status;
  const iconColor = badgeTypeToIconColor[badgeType] || '$iconSubdued';

  return (
    <Badge badgeType={badgeType} badgeSize="sm">
      <Stack w={6} h={6} borderRadius="$full" bg={iconColor} mr="$1.5" />
      <Badge.Text>{displayLabel}</Badge.Text>
    </Badge>
  );
}

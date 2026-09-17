import { Badge, Stack } from '@onekeyhq/components';
import type { IOneKeyIdLastLoginMethod } from '@onekeyhq/shared/src/consts/oneKeyIdLastLoginMethod';

export function OneKeyIdLastUsedBadge({
  method,
  label,
}: {
  method: IOneKeyIdLastLoginMethod;
  label: string;
}) {
  return (
    <Stack
      position="absolute"
      right={-4}
      top={-8}
      pointerEvents="none"
      zIndex={1}
      testID={`prime-login-last-used-badge-${method}`}
    >
      <Badge badgeSize="sm" badgeType="info" borderRadius="$full">
        <Badge.Text>{label}</Badge.Text>
      </Badge>
    </Stack>
  );
}

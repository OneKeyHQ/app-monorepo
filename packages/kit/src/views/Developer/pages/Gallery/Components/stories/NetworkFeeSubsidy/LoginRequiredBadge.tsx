import { Badge, SizableText } from '@onekeyhq/components';

export function LoginRequiredBadge() {
  return (
    <Badge
      bg="$bgStrong"
      borderRadius="$1"
      borderWidth={0}
      px="$2"
      py="$0.5"
      flexShrink={0}
    >
      <SizableText size="$bodySmMedium" color="$textSubdued">
        需登录
      </SizableText>
    </Badge>
  );
}

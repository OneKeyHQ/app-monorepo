import { Icon, SizableText, Stack } from '@onekeyhq/components';

export function FirmwareUpdateBaseMessageView({
  icon,
  title,
  message,
}: {
  icon?: React.ReactNode;
  title?: string;

  message?: string;
}) {
  return (
    <Stack py="$6">
      {icon || <Icon name="ErrorOutline" size={56} />}
      {title ? (
        <SizableText my="$4" size="$heading2xl">
          {title}
        </SizableText>
      ) : null}
      {message ? (
        <SizableText color="$textSubdued">{message}</SizableText>
      ) : null}
    </Stack>
  );
}

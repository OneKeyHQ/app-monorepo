import { SizableText, Stack } from '@onekeyhq/components';

export function V4MigrationWarningMessage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Stack backgroundColor="$bgCautionSubdued" py="$3" px="$5" mb="$2">
      <SizableText>{title}</SizableText>
      <SizableText>{description}</SizableText>
    </Stack>
  );
}

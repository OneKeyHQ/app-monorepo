import { MotiView } from 'moti';

import { SizableText, Skeleton, Stack } from '@onekeyhq/components';

const Spacer = ({ height = 16 }: { height?: number }) => (
  <MotiView style={{ height }} />
);

export function FirmwareCheckingLoading({
  connectId,
}: {
  connectId: string | undefined;
}) {
  return (
    <Stack py="$8">
      <Skeleton radius="round" height={56} width={56} />
      <SizableText my="$6" size="$heading2xl">
        Checking for updates...{' '}
      </SizableText>
      <Skeleton width={250} height={24} />
      <Spacer height={12} />
      <Skeleton width="100%" height={24} />
      <Spacer height={12} />
      <Skeleton width="100%" height={24} />
      {process.env.NODE_ENV !== 'production' ? (
        <SizableText mt="$8">connectId={connectId}</SizableText>
      ) : null}
    </Stack>
  );
}

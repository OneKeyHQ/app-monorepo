import { SizableText, Spinner, Stack } from '@onekeyhq/components';

export function FirmwareCheckingLoading({
  connectId,
}: {
  connectId: string | undefined;
}) {
  return (
    <Stack>
      <Spinner />
      {process.env.NODE_ENV !== 'production' ? (
        <SizableText>connectId={connectId}</SizableText>
      ) : null}
    </Stack>
  );
}

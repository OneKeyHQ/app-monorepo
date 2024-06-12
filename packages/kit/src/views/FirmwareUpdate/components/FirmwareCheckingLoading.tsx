import { MotiView } from 'moti';
import { useIntl } from 'react-intl';

import { SizableText, Skeleton, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const Spacer = ({ height = 16 }: { height?: number }) => (
  <MotiView style={{ height }} />
);

export function FirmwareCheckingLoading({
  connectId,
}: {
  connectId: string | undefined;
}) {
  const intl = useIntl();
  return (
    <Stack py="$8">
      <Skeleton radius="round" height={56} width={56} />
      <SizableText my="$6" size="$heading2xl">
        {intl.formatMessage({ id: ETranslations.update_checking_for_updates })}
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

import { useIntl } from 'react-intl';

import { SizableText, Spinner, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function FirmwareCheckingLoading({
  connectId,
}: {
  connectId: string | undefined;
}) {
  const intl = useIntl();
  return (
    <Stack ai="center" jc="center" h={500}>
      <Spinner size="large" />
      <SizableText my="$6" size="$headingLg">
        {intl.formatMessage({ id: ETranslations.update_checking_for_updates })}
      </SizableText>
      {process.env.NODE_ENV !== 'production' ? (
        <SizableText mt="$8">connectId={connectId}</SizableText>
      ) : null}
    </Stack>
  );
}

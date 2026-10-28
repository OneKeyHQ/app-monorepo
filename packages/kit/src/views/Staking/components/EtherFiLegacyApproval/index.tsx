import { useIntl } from 'react-intl';

import { Button, SizableText, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export function EtherFiLegacyApproval({
  status,
  onRetry,
  onRevoke,
}: {
  status?:
    | 'checking'
    | 'clear'
    | 'required'
    | 'submitting'
    | 'pending'
    | 'unknown';
  onRetry: () => void;
  onRevoke: () => void;
}) {
  const intl = useIntl();
  if (!status || status === 'clear') return null;
  return (
    <XStack px="$5" py="$3" ai="center" jc="space-between" gap="$3">
      <SizableText size="$bodyMd" flex={1}>
        {intl.formatMessage(
          { id: ETranslations.global_revoke_approve },
          { symbol: 'liquidUSD' },
        )}
      </SizableText>
      {status === 'required' ? (
        <Button testID="etherfi-legacy-revoke" size="small" onPress={onRevoke}>
          {intl.formatMessage({ id: ETranslations.global_revoke })}
        </Button>
      ) : null}
      {status === 'pending' ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_pending })}
        </SizableText>
      ) : null}
      {status === 'unknown' || status === 'pending' ? (
        <Button testID="etherfi-legacy-retry" size="small" onPress={onRetry}>
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      ) : null}
      {status === 'checking' || status === 'submitting' ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.global_pending })}
        </SizableText>
      ) : null}
    </XStack>
  );
}

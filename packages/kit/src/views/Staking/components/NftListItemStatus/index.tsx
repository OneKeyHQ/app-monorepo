import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  IconButton,
  NumberSizeableText,
  SizableText,
  Tooltip,
  XStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type INftStatus = 'pending' | 'claimable' | 'staked';

type INftListItemStatusProps = {
  symbol: string;
  amount: string;
  tokenImageUri: string;
  confirmText?: string;
  status: INftStatus;
  onClaim?: () => Promise<void>;
};

export const NftListItemStatus = ({
  amount,
  symbol,
  tokenImageUri,
  onClaim,
  status,
}: INftListItemStatusProps) => {
  const intl = useIntl();
  const translationKey = useMemo(() => {
    const messages: Record<INftStatus, ETranslations> = {
      'claimable': ETranslations.earn_token_is_claimable,
      'pending': ETranslations.earn_token_is_pending,
      'staked': ETranslations.earn_token_is_staked,
    };
    return messages[status];
  }, [status]);
  const [loading, setLoading] = useState(false);
  const onPress = useCallback(async () => {
    try {
      setLoading(true);
      await onClaim?.();
    } finally {
      setLoading(false);
    }
  }, [onClaim]);
  return (
    <XStack justifyContent="space-between">
      <XStack alignItems="center">
        <Token size="xs" tokenImageUri={tokenImageUri} />
        <XStack ml="$2" space="$1" alignItems="center">
          <SizableText size="$bodyLg">
            {intl.formatMessage(
              { id: translationKey },
              {
                token: (
                  <SizableText>
                    <NumberSizeableText
                      size="$bodyLgMedium"
                      formatter="balance"
                    >
                      {amount}
                    </NumberSizeableText>
                    <SizableText size="$bodyLgMedium">{symbol}</SizableText>
                  </SizableText>
                ),
              },
            )}
          </SizableText>
          {status === 'pending' ? (
            <Tooltip
              renderTrigger={
                <IconButton
                  variant="tertiary"
                  size="small"
                  icon="InfoCircleOutline"
                />
              }
              renderContent={intl.formatMessage({
                id: ETranslations.earn_stake_release_period_desc,
              })}
              placement="top"
            />
          ) : null}
        </XStack>
      </XStack>
      {onClaim ? (
        <Button
          size="small"
          variant="primary"
          loading={loading}
          onPress={onPress}
        >
          {intl.formatMessage({ id: ETranslations.earn_claim })}
        </Button>
      ) : null}
    </XStack>
  );
};

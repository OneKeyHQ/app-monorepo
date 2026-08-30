import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Tooltip, XStack, YStack } from '@onekeyhq/components';
import { usePerpsNetworkStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';

import { NetworkStatusBadge } from '../../../components/NetworkStatusBadge';

const monoFontVariant: ['tabular-nums'] = ['tabular-nums'];

export function PerpNetworkStatus() {
  const intl = useIntl();
  const [networkStatus] = usePerpsNetworkStatusAtom();
  const connected = networkStatus?.connected !== false;
  const pingMs = networkStatus?.pingMs;

  const monoLabel = useMemo(() => {
    if (
      networkStatus?.connected === true &&
      pingMs !== null &&
      pingMs !== undefined
    ) {
      return `${pingMs}ms`;
    }
    return undefined;
  }, [networkStatus?.connected, pingMs]);
  const statusLabel = intl.formatMessage({
    id: connected ? ETranslations.perp_online : ETranslations.perp_offline,
  });
  const lastMessageLabel = networkStatus?.lastMessageAt
    ? formatTime(new Date(networkStatus.lastMessageAt), {
        formatTemplate: 'HH:mm:ss',
      })
    : '--';

  return (
    <Tooltip
      placement="top"
      renderContent={
        <YStack minWidth={180} gap="$2">
          <XStack justifyContent="space-between" alignItems="center" gap="$6">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_status })}
            </SizableText>
            <XStack alignItems="center" gap="$1.5">
              <SizableText
                size="$bodySmMedium"
                color={connected ? '$textSuccess' : '$textCritical'}
              >
                {statusLabel}
              </SizableText>
              <SizableText
                size="$bodySmMedium"
                color="$textSubdued"
                fontFamily="$monoRegular"
                fontVariant={monoFontVariant}
              >
                {monoLabel ?? '--ms'}
              </SizableText>
            </XStack>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center" gap="$6">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.market_last_updated })}
            </SizableText>
            <SizableText
              size="$bodySmMedium"
              fontFamily="$monoRegular"
              fontVariant={monoFontVariant}
            >
              {lastMessageLabel}
            </SizableText>
          </XStack>
        </YStack>
      }
      renderTrigger={<NetworkStatusBadge connected={connected} cursor="help" />}
    />
  );
}

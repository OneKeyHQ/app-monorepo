import { useMemo } from 'react';
import type { ComponentProps, ReactElement } from 'react';

import { useIntl } from 'react-intl';

import { Stack } from '@onekeyhq/components/src/primitives';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { Badge } from '../Badge';

export type INetworkStatusBadgeProps = {
  connected: boolean;
  indicator?: ReactElement;
  label?: string;
  monoLabel?: string;
  badgeSize?: ComponentProps<typeof Badge>['badgeSize'];
  minWidth?: ComponentProps<typeof Badge>['minWidth'];
};

export function NetworkStatusBadge({
  connected,
  indicator,
  label,
  monoLabel,
  badgeSize = 'md',
  minWidth,
}: INetworkStatusBadgeProps) {
  const intl = useIntl();

  const { badgeType, indicatorElement, badgeLabel } = useMemo(() => {
    const type = connected ? 'success' : 'critical';
    const resolvedLabel =
      label ||
      (connected
        ? intl.formatMessage({ id: ETranslations.perp_online })
        : intl.formatMessage({ id: ETranslations.perp_offline }));
    if (indicator) {
      return {
        badgeType: type,
        indicatorElement: indicator,
        badgeLabel: resolvedLabel,
      };
    }

    const indicatorBg = connected ? '$success10' : '$critical10';
    return {
      badgeType: type,
      badgeLabel: resolvedLabel,
      indicatorElement: (
        <Stack
          position="relative"
          w={8}
          h={8}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          bg="$neutral3"
          p="$1.5"
        >
          <Stack
            position="absolute"
            w={6}
            h={6}
            borderRadius="$full"
            bg={indicatorBg}
          />
        </Stack>
      ),
    };
  }, [connected, indicator, intl, label]);

  return (
    <Badge
      badgeType={badgeType}
      badgeSize={badgeSize}
      height={badgeSize === 'lg' ? 32 : 26}
      minWidth={minWidth}
      borderRadius="$full"
      pl="$2"
      px="$3"
      gap="$1.5"
      cursor="default"
    >
      {indicatorElement}
      <Badge.Text size="$bodySmMedium">{badgeLabel}</Badge.Text>
      {monoLabel ? (
        <Badge.Text
          size="$bodySmMedium"
          fontFamily="$monoRegular"
          fontVariant={['tabular-nums']}
          minWidth={40}
          textAlign="right"
        >
          {monoLabel}
        </Badge.Text>
      ) : null}
    </Badge>
  );
}

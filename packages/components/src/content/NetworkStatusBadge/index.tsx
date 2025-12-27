import { useMemo } from 'react';
import type { ComponentProps, ReactElement } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type INetworkStatusBadgeProps = {
  connected: boolean;
  indicator?: ReactElement;
  label?: string;
  badgeSize?: ComponentProps<typeof Badge>['badgeSize'];
};

export function NetworkStatusBadge({
  connected,
  indicator,
  label,
  badgeSize = 'md',
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
          w={10}
          h={10}
          borderRadius="$full"
          alignItems="center"
          justifyContent="center"
          bg="$neutral3"
          p="$1.5"
        >
          <Stack
            position="absolute"
            w={8}
            h={8}
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
      height={badgeSize === 'lg' ? 32 : 30}
      borderRadius="$full"
      pl="$2"
      px="$3"
      gap="$1.5"
      cursor="default"
    >
      {indicatorElement}
      <Badge.Text size="$bodySmMedium">{badgeLabel}</Badge.Text>
    </Badge>
  );
}

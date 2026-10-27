import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Badge } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SwapPercentageStageBadge = ({
  stage,
  onSelectStage,
  badgeSize,
  isActive,
  ...props
}: {
  stage: number;
  badgeSize?: 'sm' | 'lg';
  onSelectStage?: (stage: number) => void;
  // The chip the amount follows (the Loans router's LTV)
  isActive?: boolean;
} & IStackProps) => {
  const intl = useIntl();
  const component = (
    <Badge
      role="button"
      aria-pressed={isActive}
      badgeSize={badgeSize ?? 'sm'}
      onPress={() => {
        onSelectStage?.(stage);
      }}
      px="$1.5"
      bg={isActive ? '$bgActive' : '$bgSubdued'}
      borderRadius="$2"
      userSelect="none"
      hoverStyle={{
        bg: '$bgStrongHover',
      }}
      pressStyle={{
        bg: '$bgStrongActive',
      }}
      {...props}
    >
      <Badge.Text
        size="$bodySmMedium"
        color={isActive ? '$text' : '$textSubdued'}
      >
        {stage === 0
          ? intl.formatMessage({ id: ETranslations.Limit_market })
          : `${stage}%`}
      </Badge.Text>
    </Badge>
  );
  return component;
};

export default SwapPercentageStageBadge;

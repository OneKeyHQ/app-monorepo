import { useIntl } from 'react-intl';

import type { IStackProps } from '@onekeyhq/components';
import { Badge } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const SwapPercentageStageBadge = ({
  stage,
  onSelectStage,
  badgeSize,
  ...props
}: {
  stage: number;
  badgeSize?: 'sm' | 'lg';
  onSelectStage?: (stage: number) => void;
} & IStackProps) => {
  const intl = useIntl();
  const component = (
    <Badge
      role="button"
      badgeSize={badgeSize ?? 'sm'}
      onPress={() => {
        onSelectStage?.(stage);
      }}
      px="$1.5"
      bg="$bgSubdued"
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
      <Badge.Text size="$bodySmMedium" color="$textSubdued">
        {stage === 0
          ? intl.formatMessage({ id: ETranslations.Limit_market })
          : `${stage}%`}
      </Badge.Text>
    </Badge>
  );
  return component;
};

export default SwapPercentageStageBadge;

import type { IStackProps } from '@onekeyhq/components';
import { Badge } from '@onekeyhq/components';

const SwapPercentageStageBadge = ({
  stage,
  onSelectStage,
  badgeSize,
  key,
  ...props
}: {
  stage: number;
  badgeSize?: 'sm' | 'lg';
  onSelectStage?: (stage: number) => void;
  key: string;
} & IStackProps) => {
  const component = (
    <Badge
      key={key}
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
        {stage}%
      </Badge.Text>
    </Badge>
  );
  return component;
};

export default SwapPercentageStageBadge;

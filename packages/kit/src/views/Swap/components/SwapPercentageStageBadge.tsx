import type { IStackProps } from '@onekeyhq/components';
import { Badge, Popover } from '@onekeyhq/components';

const SwapPercentageStageBadge = ({
  stage,
  onSelectStage,
  badgeSize,
  key,
  popoverContent,
  ...props
}: {
  stage: number;
  badgeSize?: 'sm' | 'lg';
  onSelectStage?: (stage: number) => void;
  popoverContent?: React.ReactNode;
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
  if (popoverContent) {
    return (
      <Popover
        renderTrigger={component}
        renderContent={() => popoverContent}
        title=""
        showHeader={false}
      />
    );
  }
  return component;
};

export default SwapPercentageStageBadge;

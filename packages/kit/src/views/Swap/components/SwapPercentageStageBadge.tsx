import { Badge } from '@onekeyhq/components';

const SwapPercentageStageBadge = ({
  stage,
  onSelectStage,
  key,
  badgeSize,
}: {
  stage: number;
  badgeSize?: 'sm' | 'lg';
  onSelectStage?: (stage: number) => void;
  key: string;
}) => (
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
  >
    <Badge.Text>{stage}%</Badge.Text>
  </Badge>
);

export default SwapPercentageStageBadge;

import { Icon, Tooltip } from '@onekeyhq/components';

export interface IInfoIconProps {
  onPress?: () => void;
  size?: string;
  tooltip?: string;
}

export function InfoIcon({ onPress, size = '$5', tooltip }: IInfoIconProps) {
  const icon = <Icon name="InfoCircleOutline" size={size} onPress={onPress} />;

  if (tooltip) {
    return <Tooltip renderTrigger={icon} renderContent={tooltip} />;
  }

  return icon;
}

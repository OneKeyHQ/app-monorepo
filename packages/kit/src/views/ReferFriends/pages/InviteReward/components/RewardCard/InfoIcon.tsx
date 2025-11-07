import { Icon } from '@onekeyhq/components';

export interface IInfoIconProps {
  onPress?: () => void;
  size?: string;
}

export function InfoIcon({ onPress, size = '$5' }: IInfoIconProps) {
  return <Icon name="InfoCircleOutline" size={size} onPress={onPress} />;
}

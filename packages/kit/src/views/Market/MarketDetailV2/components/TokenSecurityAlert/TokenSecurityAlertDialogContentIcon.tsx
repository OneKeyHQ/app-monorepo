import { Icon } from '@onekeyhq/components';

type ITokenSecurityAlertDialogContentIconProps = {
  isWarning: boolean;
};

function TokenSecurityAlertDialogContentIcon({
  isWarning,
}: ITokenSecurityAlertDialogContentIconProps) {
  const iconName = isWarning ? 'ErrorOutline' : 'CheckRadioSolid';
  const iconColor = isWarning ? '$iconCaution' : '$iconSuccess';

  return <Icon name={iconName} size="$4" color={iconColor} />;
}

export { TokenSecurityAlertDialogContentIcon };

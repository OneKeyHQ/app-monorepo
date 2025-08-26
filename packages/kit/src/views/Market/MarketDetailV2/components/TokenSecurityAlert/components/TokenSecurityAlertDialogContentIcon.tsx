import { Icon } from '@onekeyhq/components';

type ITokenSecurityAlertDialogContentIconProps = {
  isWarning: boolean;
};

function TokenSecurityAlertDialogContentIcon({
  isWarning,
}: ITokenSecurityAlertDialogContentIconProps) {
  const iconName = isWarning ? 'ErrorSolid' : 'CheckRadioSolid';
  const iconColor = isWarning ? '$iconCaution' : '$iconSuccess';

  return <Icon name={iconName} size="$5" color={iconColor} />;
}

export { TokenSecurityAlertDialogContentIcon };

import { Icon } from '@onekeyhq/components';

type ITokenSecurityAlertDialogContentIconProps = {
  isWarning: boolean;
};

function TokenSecurityAlertDialogContentIcon({
  isWarning,
}: ITokenSecurityAlertDialogContentIconProps) {
  const iconName = isWarning ? 'XCircleOutline' : 'CheckRadioSolid';
  const iconColor = isWarning ? '$iconCritical' : '$iconSuccess';

  return <Icon name={iconName} size="$4" color={iconColor} />;
}

export { TokenSecurityAlertDialogContentIcon };

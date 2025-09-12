import { Icon } from '@onekeyhq/components';

type ITokenSecurityAlertDialogContentIconProps = {
  riskType: 'safe' | 'caution' | 'normal' | 'risk';
};

function TokenSecurityAlertDialogContentIcon({
  riskType,
}: ITokenSecurityAlertDialogContentIconProps) {
  switch (riskType) {
    case 'safe':
      return <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />;
    case 'caution':
      return <Icon name="ErrorSolid" size="$5" color="$iconCaution" />;
    case 'risk':
      return <Icon name="ShieldFailureSolid" size="$5" color="$iconCritical" />;
    case 'normal':
    default:
      return <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />;
  }
}

export { TokenSecurityAlertDialogContentIcon };

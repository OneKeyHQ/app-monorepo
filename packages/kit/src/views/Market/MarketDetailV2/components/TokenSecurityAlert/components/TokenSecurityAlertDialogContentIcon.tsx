import { Icon } from '@onekeyhq/components';

type ITokenSecurityAlertDialogContentIconProps = {
  isWarning: boolean;
  riskType?: 'safe' | 'caution' | 'normal' | 'risk';
};

function TokenSecurityAlertDialogContentIcon({
  isWarning,
  riskType = 'normal',
}: ITokenSecurityAlertDialogContentIconProps) {
  switch (riskType) {
    case 'safe':
      return <Icon name="CheckRadioSolid" size="$5" color="$iconSuccess" />;
    case 'caution':
      return <Icon name="InfoCircleSolid" size="$5" color="$iconCaution" />;
    case 'risk':
      return <Icon name="ErrorSolid" size="$5" color="$iconCritical" />;
    case 'normal':
    default:
      return (
        <Icon
          name={isWarning ? 'ErrorSolid' : 'CheckRadioSolid'}
          size="$5"
          color={isWarning ? '$iconCaution' : '$iconSuccess'}
        />
      );
  }
}

export { TokenSecurityAlertDialogContentIcon };

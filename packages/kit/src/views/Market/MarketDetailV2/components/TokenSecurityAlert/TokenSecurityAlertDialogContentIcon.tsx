import type { FC } from 'react';

import { Icon } from '@onekeyhq/components';

type ITokenSecurityAlertDialogContentIconProps = {
  isWarning: boolean;
};

const TokenSecurityAlertDialogContentIcon: FC<
  ITokenSecurityAlertDialogContentIconProps
> = ({ isWarning }) => {
  const iconName = isWarning ? 'XCircleOutline' : 'CheckRadioSolid';
  const iconColor = isWarning ? '$iconCritical' : '$iconSuccess';

  return <Icon name={iconName} size="$4" color={iconColor} />;
};

export { TokenSecurityAlertDialogContentIcon };

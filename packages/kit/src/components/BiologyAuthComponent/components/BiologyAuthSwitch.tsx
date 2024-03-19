import { memo } from 'react';

import { Switch } from '@onekeyhq/components';

interface IBiologyAuthSwitchProps {
  isSupport: boolean;
  isBiologyAuthEnable: boolean;
  onChange: (checked: boolean) => void;
}

const BiologyAuthSwitch = ({
  isSupport,
  isBiologyAuthEnable,
  onChange,
}: IBiologyAuthSwitchProps) =>
  isSupport ? (
    <Switch size="small" value={isBiologyAuthEnable} onChange={onChange} />
  ) : null;

export default memo(BiologyAuthSwitch);

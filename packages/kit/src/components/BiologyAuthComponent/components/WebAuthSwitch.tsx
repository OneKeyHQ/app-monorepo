import { memo } from 'react';

import { Switch } from '@onekeyhq/components';

interface IWebAuthSwitchProps {
  isSupport: boolean;
  isWebAuthEnable: boolean;
  onChange: (checked: boolean) => void;
}

const WebAuthSwitch = ({
  isSupport,
  isWebAuthEnable,
  onChange,
}: IWebAuthSwitchProps) =>
  isSupport ? (
    <Switch size="small" value={isWebAuthEnable} onChange={onChange} />
  ) : null;

export default memo(WebAuthSwitch);

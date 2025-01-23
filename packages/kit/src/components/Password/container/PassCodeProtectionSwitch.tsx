import type { ISwitchProps } from '@onekeyhq/components';
import { Switch } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

/**
 * PassCodeProtectionSwitch component
 * @param {ISwitchProps} switchProps - Props to be passed to the underlying Switch component
 */
const PassCodeProtectionSwitch = (switchProps: ISwitchProps) => {
  const [{ enablePasswordErrorProtection }, setPasswordPersist] =
    usePasswordPersistAtom();

  return (
    <Switch
      value={enablePasswordErrorProtection}
      onChange={(value: boolean) => {
        setPasswordPersist((v) => ({
          ...v,
          enablePasswordErrorProtection: value,
        }));
      }}
      {...switchProps}
    />
  );
};

export default PassCodeProtectionSwitch;

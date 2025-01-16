import type { ISwitchProps } from '@onekeyhq/components';
import { Switch } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const PassCodeProtectionSwitch = (switchProps: ISwitchProps) => {
  const [{ enablePasswordErrorProtection }, setPasswordPersist] =
    usePasswordPersistAtom();

  return (
    <Switch
      {...switchProps}
      value={enablePasswordErrorProtection}
      onChange={(value: boolean) => {
        setPasswordPersist((v) => ({
          ...v,
          enablePasswordErrorProtection: value,
        }));
      }}
    />
  );
};

export default PassCodeProtectionSwitch;

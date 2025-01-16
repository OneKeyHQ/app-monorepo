import { Switch } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const PassCodeProtectionSwitch = (props: { size: string }) => {
  const { size } = props;
  const [{ enablePasswordErrorProtection }, setPasswordPersist] =
    usePasswordPersistAtom();
  return (
    <Switch
      size={size}
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

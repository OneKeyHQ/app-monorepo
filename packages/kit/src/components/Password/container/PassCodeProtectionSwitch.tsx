import type { ISwitchProps } from '@onekeyhq/components';
import { Switch } from '@onekeyhq/components';
import { usePasswordPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

/**
 * PassCodeProtectionSwitch component
 * @param {ISwitchProps} switchProps - Props to be passed to the underlying Switch component
 */
const PassCodeProtectionSwitch = ({
  onChange,
  onTransition = () => {},
  ...switchProps
}: ISwitchProps & {
  onTransition?: (fn: () => Promise<void>) => void;
}) => {
  const [{ enablePasswordErrorProtection }, setPasswordPersist] =
    usePasswordPersistAtom();

  return (
    <Switch
      value={enablePasswordErrorProtection}
      onChange={(value: boolean) => {
        onTransition?.(async () => {
          setPasswordPersist((v) => ({
            ...v,
            enablePasswordErrorProtection: value,
          }));
          onChange?.(value);
        });
      }}
      {...switchProps}
    />
  );
};

export default PassCodeProtectionSwitch;

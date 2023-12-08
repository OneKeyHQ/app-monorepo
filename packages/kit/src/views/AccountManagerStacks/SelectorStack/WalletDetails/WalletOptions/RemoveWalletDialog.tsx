import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox } from '@onekeyhq/components';

export function RemoveWalletDialog({
  defaultValue,
  onChange,
}: {
  defaultValue: boolean;
  onChange: (checked: boolean) => void;
}) {
  const [value, changeValue] = useState(defaultValue);
  const handleChange = useCallback(
    (checked: ICheckedState) => {
      changeValue(!!checked);
      onChange(!!checked);
    },
    [onChange],
  );
  return (
    <Checkbox
      value={value}
      onChange={handleChange}
      label="I've written down the recovery phrase"
    />
  );
}

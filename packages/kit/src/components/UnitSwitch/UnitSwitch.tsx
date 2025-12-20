import { useCallback, useState } from 'react';

import { SegmentControl } from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';

function UnitSwitch(props: ISegmentControlProps) {
  const { value, onChange } = props;
  const [selectedValue, setSelectedValue] = useState(value);
  const handleChange = useCallback(
    (v: string | number) => {
      setSelectedValue(v as string);
      if (v !== selectedValue) {
        onChange?.(v as string);
      }
    },
    [onChange, selectedValue],
  );
  return (
    <SegmentControl
      segmentControlItemStyleProps={{
        px: 5,
        py: 2.5,
      }}
      {...props}
      onChange={handleChange}
    />
  );
}

export { UnitSwitch };

import { SegmentControl } from '@onekeyhq/components';
import type { ISegmentControlProps } from '@onekeyhq/components';

function UnitSwitch(props: ISegmentControlProps) {
  return (
    <SegmentControl
      segmentControlItemStyleProps={{
        px: 5,
        py: 2.5,
      }}
      {...props}
    />
  );
}

export { UnitSwitch };

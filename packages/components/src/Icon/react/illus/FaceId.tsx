import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgFaceId = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" {...props}>
    <Path
      d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2-2v-2M15.5 9v1M8.5 9v1M9 15.125S10 16 12 16s3-.875 3-.875M12 9v3a.5.5 0 0 1-.5.5H11"
      stroke="#8C8CA1"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>
);

export default SvgFaceId;

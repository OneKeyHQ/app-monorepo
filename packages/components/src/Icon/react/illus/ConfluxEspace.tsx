import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgConfluxEspace = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      d="m4.627 10.135 3.428-3.428L9.1 7.75l-2.385 2.385 1.341 1.341 2.385-2.385 1.043 1.044-3.428 3.428-3.428-3.428Z"
    />
    <Path
      fill="#8C8CA1"
      d="M3.6 6.972v2.12L8.04 4.652l4.438 4.438v-2.12L8.039 2.534 3.6 6.972Z"
    />
  </Svg>
);
export default SvgConfluxEspace;

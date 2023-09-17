import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgArrowTop = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m14.79 6.04 4.585 4.585a2 2 0 0 1 0 2.828l-4.586 4.586m4.25-6h-15"
    />
  </Svg>
);
export default SvgArrowTop;

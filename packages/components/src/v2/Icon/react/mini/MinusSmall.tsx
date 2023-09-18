import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgMinusSmall = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 20 20"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.75 9.25a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5z" />
  </Svg>
);
export default SvgMinusSmall;

import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKaspa = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      d="m10.08 3.358-1.697.254.495 3.29L5.323 4.16 4.281 5.525 7.394 7.92l-3.113 2.408 1.042 1.364L8.878 8.95l-.495 3.29 1.697.255.682-4.575-.682-4.562Z"
    />
  </Svg>
);
export default SvgKaspa;

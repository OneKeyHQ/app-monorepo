import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLocationMap = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M21.5 14v5c0 1.1-.9 2-2 2H6c-1.93 0-3.5-1.57-3.5-3.5v-11C2.5 4.57 4.07 3 6 3h1.5c.55 0 1 .45 1 1v2h2c.55 0 1 .45 1 1s-.45 1-1 1h-2v7c0 .55-.45 1-1 1H6c-.83 0-1.5.67-1.5 1.5S5.17 19 6 19h13.5v-5c0-.55.45-1 1-1s1 .45 1 1m-4.45-2.1c.14.07.29.11.45.11s.31-.04.45-.11 3.55-1.81 3.55-4.89c0-2.21-1.79-4-4-4s-4 1.79-4 4c0 3.08 3.41 4.82 3.55 4.89" />
  </Svg>
);
export default SvgLocationMap;

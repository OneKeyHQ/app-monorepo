import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgPercent = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m-5.207-4.207a1 1 0 1 1 1.414 1.414l-7 7a1 1 0 1 1-1.414-1.414zM22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
    <Path d="M9.5 9a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m.75 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0m5.25 6a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m.75 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0" />
  </Svg>
);
export default SvgPercent;

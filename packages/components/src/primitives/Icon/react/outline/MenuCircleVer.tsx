import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMenuCircleVer = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M20 12a8 8 0 1 0-16 0 8 8 0 0 0 16 0m2 0c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
    <Path d="M11.125 8a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0" />
    <Path d="M12.5 8a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m.75 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0m-2.125 4a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0" />
    <Path d="M12.5 12a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m.75 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0m-2.125 4a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0" />
    <Path d="M12.5 16a.5.5 0 1 0-1 0 .5.5 0 0 0 1 0m.75 0a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0" />
  </Svg>
);
export default SvgMenuCircleVer;

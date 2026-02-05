import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRadar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 12a3.99 3.99 0 0 0-1.15-2.807l-1.102 1.836a2 2 0 1 1-3.497 0L9.149 9.193A4 4 0 1 0 16 12m-4-8a8 8 0 0 0-3.227.679L11.967 10H12l.032.001 3.194-5.322A8 8 0 0 0 12 4m6 8a6 6 0 1 1-9.9-4.557L7.06 5.71a8 8 0 1 0 9.88 0L15.9 7.443A5.99 5.99 0 0 1 18 12m4 0c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
  </Svg>
);
export default SvgRadar;

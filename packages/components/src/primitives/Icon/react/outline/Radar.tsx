import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRadar = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m3.9 5.443A5.99 5.99 0 0 1 18 12a6 6 0 1 1-9.9-4.557L7.06 5.71a8 8 0 1 0 9.88 0zm-2.152 3.586a2 2 0 1 1-3.497 0L9.149 9.193a4 4 0 1 0 5.7 0zM12 4a8 8 0 0 0-3.227.679L11.967 10H12l.032.001 3.194-5.322A8 8 0 0 0 12 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgRadar;

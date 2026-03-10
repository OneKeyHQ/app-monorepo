import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMedalWin = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 1a8 8 0 0 1 5 14.242v8.376l-5-2.5-5 2.5v-8.376A8 8 0 0 1 12 1m3 15.416A8 8 0 0 1 12 17a8 8 0 0 1-3-.584v3.966l3-1.5 3 1.5zM12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMedalWin;

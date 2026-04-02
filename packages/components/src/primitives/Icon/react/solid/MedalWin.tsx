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
      d="M12 1a8 8 0 0 1 5 14.245v8.372l-5-2.5-5 2.5v-8.372A8 8 0 0 1 12 1m3 15.419A8 8 0 0 1 12 17a8 8 0 0 1-3-.581v3.963l3-1.5 3 1.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMedalWin;

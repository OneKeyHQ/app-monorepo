import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTargetCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1 11.5V18h2v-4.5zM6 13h4.5v-2H6zm7.5 0H18v-2h-4.5zM11 6v4.5h2V6z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTargetCircle;

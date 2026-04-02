import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowRightCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-.414 7 2 2H7v2h6.586l-2 2L13 16.414 17.414 12 13 7.586z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowRightCircle;

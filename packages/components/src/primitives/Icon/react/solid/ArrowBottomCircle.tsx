import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgArrowBottomCircle = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2m-1 5v6.586l-2-2L7.586 13 12 17.414 16.414 13 15 11.586l-2 2V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgArrowBottomCircle;

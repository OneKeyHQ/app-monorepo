import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.414 19 12 22.414 8.586 19 10 17.586l2 2 2-2zM7.01 12H5v-2h2.01zM15 12H9v-2h6zm4.01 0H17v-2h2.01zm-12-4H5V6h2.01zm4 0H9V6h2.01zm4 0H13V6h2.01zm4 0H17V6h2.01z" />
    <Path
      fillRule="evenodd"
      d="M23 16H1V2h22zM3 14h18V4H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardDown;

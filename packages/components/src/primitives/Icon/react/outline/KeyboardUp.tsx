import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardUp = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.01 18H5v-2h2.01zM15 18H9v-2h6zm4.01 0H17v-2h2.01zm-12-4H5v-2h2.01zm4 0H9v-2h2.01zm4 0H13v-2h2.01zm4 0H17v-2h2.01z" />
    <Path
      fillRule="evenodd"
      d="M23 22H1V8h22zM3 20h18V10H3z"
      clipRule="evenodd"
    />
    <Path d="M15.414 5 14 6.414l-2-2-2 2L8.586 5 12 1.586z" />
  </Svg>
);
export default SvgKeyboardUp;

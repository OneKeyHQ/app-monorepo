import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKeyboardConnect = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M7.01 18H5v-2h2.01zM15 18H9v-2h6zm4.01 0H17v-2h2.01zm-12-4H5v-2h2.01zm4 0H9v-2h2.01zm4 0H13v-2h2.01zm4 0H17v-2h2.01z" />
    <Path
      fillRule="evenodd"
      d="M19 6H7v2h16v14H1V8h4V4h12V2h2zM3 20h18V10H3z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKeyboardConnect;

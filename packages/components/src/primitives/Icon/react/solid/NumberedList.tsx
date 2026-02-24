import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNumberedList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.612 13.5c1.423 0 2.389 1.103 2.389 2.389 0 .765-.33 1.353-.732 1.79-.306.332-.679.603-1.003.821H8.25v2H3v-1c0-.754.392-1.3.778-1.668.328-.312.743-.581 1.069-.793l.106-.07c.385-.25.658-.444.843-.645.16-.175.204-.301.204-.435a.4.4 0 0 0-.1-.287c-.045-.048-.129-.102-.289-.102-.408 0-.883.258-1.329.694l-1.4-1.428c.593-.581 1.548-1.266 2.73-1.266M21 18H11v-2h10zM7 10.5H5V6.004l-1.208.894-1.19-1.606L5.02 3.5H7zM21 8H11V6h10z" />
  </Svg>
);
export default SvgNumberedList;

import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgNumberedList = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5.996 15.889a.4.4 0 0 0-.1-.287c-.045-.048-.129-.102-.289-.102-.408 0-.883.258-1.329.694l-1.4-1.428c.593-.581 1.549-1.266 2.73-1.266 1.423 0 2.388 1.103 2.388 2.389 0 .765-.33 1.353-.732 1.79-.307.333-.68.603-1.004.821h1.986v2h-5.25v-1c0-.754.392-1.3.778-1.668.365-.347.837-.641 1.175-.862.385-.252.658-.445.843-.646.16-.175.204-.301.204-.435M21 18H11v-2h10zM7 10.5H5V6.004l-.404.3-.804.594-1.19-1.606L5.02 3.5H7zM21 8H11V6h10z" />
  </Svg>
);
export default SvgNumberedList;

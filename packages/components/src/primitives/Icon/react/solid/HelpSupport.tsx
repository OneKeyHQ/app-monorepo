import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHelpSupport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M1.75 11.5a2.5 2.5 0 0 1 2.033-2.457C4.165 5.04 7.758 2 12 2s7.835 3.04 8.216 7.043A2.5 2.5 0 0 1 22.25 11.5V15a2.5 2.5 0 0 1-1.825 2.408A5.5 5.5 0 0 1 15 22h-1.75a2.5 2.5 0 0 1-2.5-2.5V19a1 1 0 1 1 2 0v.5a.5.5 0 0 0 .5.5H15a3.5 3.5 0 0 0 3.355-2.5h-.105a1 1 0 0 1-1-1V10a1 1 0 0 1 .947-.999C17.8 6.228 15.234 4 12 4S6.2 6.228 5.803 9.001A1 1 0 0 1 6.75 10v6.5a1 1 0 0 1-1 1h-1.5a2.5 2.5 0 0 1-2.5-2.5z" />
  </Svg>
);
export default SvgHelpSupport;

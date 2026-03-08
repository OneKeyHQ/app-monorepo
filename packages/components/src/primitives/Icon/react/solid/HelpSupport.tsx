import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHelpSupport = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.25 2c4.241 0 7.835 3.04 8.217 7.043A2.5 2.5 0 0 1 22.5 11.5V15a2.5 2.5 0 0 1-1.824 2.407A5.5 5.5 0 0 1 15.25 22H11v-4h2v2h2.25a3.5 3.5 0 0 0 3.355-2.5H17.5V9h.946c-.397-2.772-2.963-5-6.196-5s-5.8 2.228-6.196 5H7v8.5H4.5A2.5 2.5 0 0 1 2 15v-3.5c0-1.221.876-2.238 2.033-2.457C4.415 5.04 8.01 2 12.25 2" />
  </Svg>
);
export default SvgHelpSupport;

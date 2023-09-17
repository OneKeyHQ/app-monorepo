import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBulkSender = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 26 24" accessibilityRole="image" {...props}>
    <Path
      fill="#4786FF"
      d="M8.2.8a1.6 1.6 0 0 0 0 3.2h9.6a1.6 1.6 0 1 0 0-3.2H8.2ZM3.4 7.2A1.6 1.6 0 0 1 5 5.6h16a1.6 1.6 0 1 1 0 3.2H5a1.6 1.6 0 0 1-1.6-1.6ZM.2 13.6a3.2 3.2 0 0 1 3.2-3.2h19.2a3.2 3.2 0 0 1 3.2 3.2V20a3.2 3.2 0 0 1-3.2 3.2H3.4A3.2 3.2 0 0 1 .2 20v-6.4Z"
    />
  </Svg>
);
export default SvgBulkSender;

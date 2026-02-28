import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTicket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m22 9.927-.629.252c-1.661.665-1.661 2.977 0 3.642l.629.252V20H2v-5.927l.629-.252c1.661-.665 1.661-2.977 0-3.642L2 9.927V4h20zM14 15v2h2v-2zm0-4v2h2v-2zm0-4v2h2V7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTicket;

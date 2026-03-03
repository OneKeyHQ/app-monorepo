import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTicket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M16 17.01h-2V15h2zm0-4h-2V11h2zm0-4h-2V7h2z" />
    <Path
      fillRule="evenodd"
      d="m22 9.927-.629.252c-1.661.665-1.661 2.977 0 3.642l.629.252V20H2v-5.927l.629-.252c1.661-.665 1.661-2.977 0-3.642L2 9.927V4h20zM4 8.636c2.5 1.52 2.499 5.207 0 6.727V18h16v-2.637c-2.499-1.52-2.5-5.208 0-6.727V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTicket;

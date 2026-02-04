import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTicket = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M4 6v2.636c2.5 1.52 2.499 5.207 0 6.727V18h16v-2.637c-2.499-1.52-2.5-5.208 0-6.727V6zm10 9.51v-.01a1 1 0 1 1 2 0v.01a1 1 0 1 1-2 0m0-3.5V12a1 1 0 1 1 2 0v.01a1 1 0 1 1-2 0m0-3.5V8.5a1 1 0 1 1 2 0v.01a1 1 0 1 1-2 0m8 .74a1 1 0 0 1-.629.929c-1.661.665-1.661 2.977 0 3.642a1 1 0 0 1 .629.929V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3.25a1 1 0 0 1 .629-.929c1.661-.665 1.661-2.977 0-3.642A1 1 0 0 1 2 9.25V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgTicket;

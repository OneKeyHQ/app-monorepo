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
      d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3.25a1 1 0 0 1-.629.928c-1.662.665-1.662 2.979 0 3.643a1 1 0 0 1 .629.929V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-3.25a1 1 0 0 1 .629-.928c1.661-.665 1.661-2.979 0-3.643A1 1 0 0 1 2 9.25zm13 1a1 1 0 0 1 1 1v.01a1 1 0 1 1-2 0V8a1 1 0 0 1 1-1m0 4a1 1 0 0 1 1 1v.01a1 1 0 1 1-2 0V12a1 1 0 0 1 1-1m0 4a1 1 0 0 1 1 1v.01a1 1 0 1 1-2 0V16a1 1 0 0 1 1-1"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTicket;

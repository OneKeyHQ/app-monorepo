import Svg, { Path, Circle } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWindowsHello = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M20 15.583c-.811 1.216-1.978 2.226-3.382 2.928A10.36 10.36 0 0 1 12 19.583c-1.621 0-3.214-.37-4.618-1.072S4.812 16.8 4 15.583"
    />
    <Circle cx={6.5} cy={6.5} r={2.5} fill="currentColor" />
    <Circle cx={17.5} cy={6.5} r={2.5} fill="currentColor" />
  </Svg>
);
export default SvgWindowsHello;

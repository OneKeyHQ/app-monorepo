import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgCoinbase = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.019 17a5.003 5.003 0 0 1-5.01-5c0-2.762 2.242-5 5.01-5a5.006 5.006 0 0 1 4.934 4.166H22C21.574 6.034 17.27 2 12.019 2 6.488 2 2 6.48 2 12s4.488 10 10.019 10c5.251 0 9.555-4.033 9.981-9.166h-5.047A5.006 5.006 0 0 1 12.019 17" />
  </Svg>
);
export default SvgCoinbase;
